// @vitest-environment node
import { MIN_KDF_PARAMS } from 'keyslot'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createSession, MIN_STORE_PASSPHRASE_LENGTH, UNLOCK_FAILED, type Session } from './session'

const PASS = 'a long enough fixture passphrase'
const dirs: string[] = []
const sessions: Session[] = []

function fresh(dir = mkdtempSync(join(tmpdir(), 'cadre-session-'))) {
  if (!dirs.includes(dir)) dirs.push(dir)
  const session = createSession({ dataDir: dir, kdf: MIN_KDF_PARAMS })
  sessions.push(session)
  return { session, dir }
}

afterEach(async () => {
  for (const s of sessions.splice(0)) await s.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('session', () => {
  it('starts with no store, creates one on first run, and unlocks it', async () => {
    const { session } = fresh()
    await session.init()
    expect(session.hasStore.value).toBe(false)

    expect(await session.create(PASS)).toBe(true)
    expect(session.unlocked.value).toBe(true)
    expect(session.repository.value).not.toBeNull()
  })

  it('refuses a too-short passphrase for a new store without creating one', async () => {
    const { session } = fresh()
    await session.init()

    expect(await session.create('x'.repeat(MIN_STORE_PASSPHRASE_LENGTH - 1))).toBe(false)
    expect(session.error.value).toContain(String(MIN_STORE_PASSPHRASE_LENGTH))
    expect(session.hasStore.value).toBe(false)
  })

  it('lock wipes the keys and repository; the same passphrase unlocks the data again', async () => {
    const { session, dir } = fresh()
    await session.init()
    await session.create(PASS)
    await session.repository.value!.create({
      displayName: 'Ada Example',
      email: null,
      phone: null,
      role: null,
      notes: null,
    })

    await session.lock()
    expect(session.unlocked.value).toBe(false)
    expect(session.repository.value).toBeNull()
    expect(session.hasStore.value).toBe(true)

    expect(await session.unlock(PASS)).toBe(true)
    const page = await session.repository.value!.list()
    expect(page.items.map((m) => m.displayName)).toEqual(['Ada Example'])
    expect(dir).toBeTruthy()
  })

  it('a wrong passphrase stays locked with the one generic message', async () => {
    const { session } = fresh()
    await session.init()
    await session.create(PASS)
    await session.lock()

    expect(await session.unlock('not the passphrase at all')).toBe(false)
    expect(session.unlocked.value).toBe(false)
    expect(session.error.value).toBe(UNLOCK_FAILED)
    expect(session.hasStore.value).toBe(true)
  })

  it('a damaged slot gives the same message as a wrong passphrase', async () => {
    const { session, dir } = fresh()
    await session.init()
    await session.create(PASS)
    await session.close()

    const { KeySlotStore } = await import('../storage/keySlotStore')
    const store = await KeySlotStore.open({ dataDir: dir })
    const slot = (await store.readSlot())!
    slot[slot.length - 1] = slot[slot.length - 1]! ^ 0xff
    await store.writeSlot(slot)
    await store.close()

    await session.init()
    expect(await session.unlock(PASS)).toBe(false)
    expect(session.error.value).toBe(UNLOCK_FAILED)
  })

  it('does not put the passphrase or a member name into the error message', async () => {
    const { session } = fresh()
    await session.init()
    await session.create(PASS)
    await session.lock()
    await session.unlock('wrong wrong wrong wrong')
    expect(session.error.value).not.toContain('wrong wrong')
  })
})
