// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { DEFAULT_KDF_PARAMS, MIN_KDF_PARAMS, readSlotParams, UnlockError } from 'keyslot'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { StoreExistsError, type OpenLedger } from '../domain/LedgerStore'
import { PGliteStore } from './PGliteStore'

const PASSPHRASE = 'fixture passphrase, not a real one'
const fixture = {
  displayName: 'Quillfeather Fixturename',
  email: 'quillfeather.fixture@example.invalid',
  phone: null,
  role: null,
  notes: null,
  expiresAt: null,
}

const dirs: string[] = []
const opened: OpenLedger[] = []

function makeStore(): { store: PGliteStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cadre-store-'))
  dirs.push(dir)
  const store = new PGliteStore({
    openDb: () => new PGlite(dir),
    kdf: MIN_KDF_PARAMS,
    exportKdf: MIN_KDF_PARAMS,
  })
  return { store, dir }
}

async function track(ledger: Promise<OpenLedger>): Promise<OpenLedger> {
  const open = await ledger
  opened.push(open)
  return open
}

async function readSlotRows(dir: string): Promise<Uint8Array[]> {
  const db = new PGlite(dir)
  try {
    const { rows } = await db.query<{ slot: Uint8Array }>(`SELECT slot FROM key_slots`)
    return rows.map((row) => row.slot)
  } finally {
    await db.close()
  }
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((open) => open.lock()))
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('PGliteStore', () => {
  it('reports a new store, then an existing one once created', async () => {
    const { store } = makeStore()
    expect(await store.probe()).toBe('new')
    await (await store.create(PASSPHRASE)).lock()
    expect(await store.probe()).toBe('existing')
  })

  it('creates a store whose repository works, and unlocks it again after locking', async () => {
    const { store } = makeStore()
    const first = await track(store.create(PASSPHRASE))
    const member = await first.repository.create(fixture)
    await first.lock()

    const second = await track(store.unlock(PASSPHRASE))
    expect((await second.repository.read(member.id))?.displayName).toBe(fixture.displayName)
  }, 30_000)

  it('raises a slot below the current Argon2id defaults on unlock and writes it back', async () => {
    const { store, dir } = makeStore()
    await (await store.create(PASSPHRASE)).lock()
    expect(readSlotParams((await readSlotRows(dir))[0]!).memlimit).toBe(MIN_KDF_PARAMS.memlimit)

    await (await store.unlock(PASSPHRASE)).lock()
    const slots = await readSlotRows(dir)
    expect(slots).toHaveLength(1)
    expect(readSlotParams(slots[0]!).memlimit).toBe(DEFAULT_KDF_PARAMS.memlimit)
  }, 30_000)

  it('locking drops the keys: the repository stops working', async () => {
    const { store } = makeStore()
    const open = await store.create(PASSPHRASE)
    await open.lock()
    await open.lock() // idempotent
    await expect(open.repository.list()).rejects.toThrow()
  })

  it('fails a wrong passphrase and a store with no slot with the same error', async () => {
    const { store } = makeStore()
    const noSlot = await store.unlock(PASSPHRASE).catch((error: unknown) => error)
    await (await store.create(PASSPHRASE)).lock()
    const wrong = await store.unlock('not the passphrase at all').catch((error: unknown) => error)

    expect(noSlot).toBeInstanceOf(UnlockError)
    expect(wrong).toBeInstanceOf(UnlockError)
    expect((wrong as Error).message).toBe((noSlot as Error).message)
  }, 30_000)

  it('refuses to create over an existing store', async () => {
    const { store, dir } = makeStore()
    await (await store.create(PASSPHRASE)).lock()
    await expect(store.create('a different passphrase entirely')).rejects.toBeInstanceOf(
      StoreExistsError,
    )
    expect(await readSlotRows(dir)).toHaveLength(1)
  })
})
