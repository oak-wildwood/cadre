// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { createPassphraseSlot, MIN_KDF_PARAMS, UnlockError, UnsupportedFormatError } from 'keyslot'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { BLIND_INDEX_RULES_VERSION } from '../crypto/blindIndex'
import { encryptMemberField } from '../crypto/memberFields'
import type { ListQuery, Page } from '../domain/listQuery'
import type { Member } from '../domain/member'
import { describeRepositoryContract } from '../domain/repository.contract.spec'
import { SENSITIVE_FIELD_NAMES, encryptedColumn } from '../domain/sensitiveFields'
import { BundleVersionError, ExportPassphraseTooShortError } from '../crypto/exportBundle'
import { BUNDLED_MIGRATIONS } from './bundledMigrations'
import { PGliteRepository } from './PGliteRepository'

const { keyRing } = await createPassphraseSlot('test passphrase, not real', {
  kdf: MIN_KDF_PARAMS,
})

type Row = Record<string, unknown>

const open: PGliteRepository[] = []
const tempDirs: string[] = []

function makeRepo(options: { dataDir?: string; db?: PGlite } = {}): PGliteRepository {
  const repo = new PGliteRepository({ keyRing, exportKdf: MIN_KDF_PARAMS, ...options })
  open.push(repo)
  return repo
}

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cadre-pglite-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((repo) => repo.close()))
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describeRepositoryContract(() => makeRepo())

describe('PGliteRepository', () => {
  const ada = {
    displayName: 'Quillfeather Fixturename',
    email: 'quillfeather.fixture@example.invalid',
    phone: '+1-555-0142-7731',
    role: 'zz-fixture-organizer',
    notes: 'Fixture note: met at the marmalade-otter planning session.',
    expiresAt: null,
  }

  it('bundles every migration and runs them on open', async () => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    await repo.ready()

    const versions = BUNDLED_MIGRATIONS.map((m) => m.version).sort((a, b) => a - b)
    expect(versions.length).toBeGreaterThan(0)
    const { rows } = await db.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    )
    expect(rows.map((r) => r.version)).toEqual(versions)
  })

  it('survives a reload: a fresh instance on the same data dir reads the same member', async () => {
    const dataDir = tempDir()
    const first = makeRepo({ dataDir })
    const created = await first.create(ada)
    await first.close()

    const second = makeRepo({ dataDir })

    expect(await second.read(created.id)).toEqual(created)
    expect((await second.findByBlindIndex('email', ada.email)).map((m) => m.id)).toEqual([
      created.id,
    ])
  })

  it('stores only ciphertext and blind indexes for sensitive fields', async () => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    const created = await repo.create(ada)

    const { rows } = await db.query<Record<string, unknown>>('SELECT * FROM members')
    expect(rows).toHaveLength(1)
    const stored = Buffer.from(
      JSON.stringify(rows[0], (_, v) =>
        v instanceof Uint8Array ? Buffer.from(v).toString('latin1') : v,
      ),
      'latin1',
    )
    for (const value of Object.values(ada)) {
      if (typeof value === 'string') {
        expect(stored.includes(Buffer.from(value)), `plaintext stored: ${value}`).toBe(false)
      }
    }
    for (const field of SENSITIVE_FIELD_NAMES) {
      expect(rows[0]![encryptedColumn(field)]).toBeInstanceOf(Uint8Array)
    }
    expect(rows[0]!.id).toBe(created.id)
  })

  it('clears a field and its blind index when patched to null', async () => {
    const repo = makeRepo()
    const created = await repo.create(ada)

    const updated = await repo.update(created.id, { email: null })

    expect(updated.email).toBeNull()
    expect(updated.phone).toBe(ada.phone)
    expect(await repo.findByBlindIndex('email', ada.email)).toEqual([])
  })

  it('refuses a blind-index lookup on a field without one', async () => {
    const repo = makeRepo()

    // @ts-expect-error role is deliberately not blind-indexed (record 0007, decision 9)
    await expect(repo.findByBlindIndex('role', 'organizer')).rejects.toThrow(/no blind index/)
  })

  it('does not match a partial value', async () => {
    const repo = makeRepo()
    await repo.create(ada)

    expect(await repo.findByBlindIndex('displayName', 'Quillfeather')).toEqual([])
    expect(await repo.findByBlindIndex('email', 'quillfeather.fixture')).toEqual([])
    expect(await repo.findByBlindIndex('phone', '0142')).toEqual([])
  })

  it('finds a member by email and phone under the field-specific rules (record 0008)', async () => {
    const repo = makeRepo()
    const created = await repo.create(ada)

    const byEmail = await repo.findByBlindIndex('email', ' QUILLFEATHER.Fixture@Example.INVALID ')
    const byPhone = await repo.findByBlindIndex('phone', '+1 (555) 0142 7731')
    expect(byEmail.map((m) => m.id)).toEqual([created.id])
    expect(byPhone.map((m) => m.id)).toEqual([created.id])
    // No country-code inference.
    expect(await repo.findByBlindIndex('phone', '555 0142 7731')).toEqual([])
  })

  it('stores no index for a blank value, and a blank search matches nothing', async () => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    await repo.create({ ...ada, phone: ' + ', email: '   ' })
    await repo.create({ ...ada, phone: '()', email: '' })

    const { rows } = await db.query<Row>('SELECT phone_bidx, email_bidx FROM members')
    expect(rows).toEqual([
      { phone_bidx: null, email_bidx: null },
      { phone_bidx: null, email_bidx: null },
    ])
    expect(await repo.findByBlindIndex('phone', '')).toEqual([])
    expect(await repo.findByBlindIndex('email', ' ')).toEqual([])
  })

  it('rejects a display name that normalizes to empty, writing nothing', async () => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    await expect(repo.create({ ...ada, displayName: ' \t ' })).rejects.toThrow(/displayName/)
    const created = await repo.create(ada)
    await expect(repo.update(created.id, { displayName: '　' })).rejects.toThrow(/displayName/)

    expect(await repo.read(created.id)).toEqual(created)
    const { rows } = await db.query('SELECT 1 FROM members')
    expect(rows).toHaveLength(1)
  })

  it('records the blind-index rules version and rebuilds indexes from an unknown one', async () => {
    const db = new PGlite()
    const first = makeRepo({ db })
    const created = await first.create(ada)
    const { rows } = await db.query<Row>('SELECT blind_index_rules_version AS v FROM settings')
    expect(rows).toEqual([{ v: BLIND_INDEX_RULES_VERSION }])

    // A store from before the version was recorded, with indexes from other rules.
    await db.exec(`UPDATE settings SET blind_index_rules_version = NULL;
                   UPDATE members SET email_bidx = '\\x00', phone_bidx = '\\x00'`)
    expect(await first.findByBlindIndex('email', ada.email)).toEqual([])

    const reopened = new PGliteRepository({ keyRing, db })
    await reopened.ready()
    expect((await reopened.findByBlindIndex('email', ada.email)).map((m) => m.id)).toEqual([
      created.id,
    ])
    expect((await reopened.findByBlindIndex('phone', ada.phone)).map((m) => m.id)).toEqual([
      created.id,
    ])
    const after = await db.query<Row>('SELECT blind_index_rules_version AS v FROM settings')
    expect(after.rows).toEqual([{ v: BLIND_INDEX_RULES_VERSION }])
  })

  it('still opens a store holding a name that now normalizes to empty, keeping its old index', async () => {
    const db = new PGlite()
    const first = makeRepo({ db })
    const created = await first.create(ada)
    // A name written under interim rules that allowed it: whitespace only.
    const blankName = await encryptMemberField(keyRing, created.id, 'displayName', ' \t ')
    await db.query('UPDATE members SET display_name_enc = $1, email_bidx = $2 WHERE id = $3', [
      blankName,
      new Uint8Array([0]),
      created.id,
    ])
    await db.exec('UPDATE settings SET blind_index_rules_version = NULL')
    const before = await db.query<Row>('SELECT display_name_bidx FROM members')

    const reopened = new PGliteRepository({ keyRing, db })
    await reopened.ready()

    const after = await db.query<Row>('SELECT display_name_bidx FROM members')
    expect(after.rows).toEqual(before.rows)
    // The rest of the row was still rebuilt.
    expect((await reopened.findByBlindIndex('email', ada.email)).map((m) => m.id)).toEqual([
      created.id,
    ])
  })

  it('refuses a store whose indexes come from newer rules', async () => {
    const db = new PGlite()
    await makeRepo({ db }).ready()
    await db.query('UPDATE settings SET blind_index_rules_version = $1', [
      BLIND_INDEX_RULES_VERSION + 1,
    ])

    const reopened = new PGliteRepository({ keyRing, db })
    await expect(reopened.ready()).rejects.toBeInstanceOf(UnsupportedFormatError)
  })

  it('removes a deleted row\u2019s ciphertext from every data file outside the WAL', async () => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    const created = await repo.create(ada)
    const { rows } = await db.query<{ notes_enc: Uint8Array }>(
      'SELECT notes_enc FROM members WHERE id = $1',
      [created.id],
    )
    const ciphertext = Buffer.from(rows[0]!.notes_enc)
    await db.exec('CHECKPOINT')
    // Positive control: before the delete, the heap really does hold the bytes.
    expect(filesHolding(await dump(db), ciphertext).some((f) => !f.includes('pg_wal'))).toBe(true)

    await repo.delete(created.id)
    await db.exec('CHECKPOINT')

    expect(filesHolding(await dump(db), ciphertext).filter((f) => !f.includes('pg_wal'))).toEqual(
      [],
    )
  })

  it.each([
    ['delete', (repo: PGliteRepository, id: string) => repo.delete(id)],
    ['purgeExpired', (repo: PGliteRepository) => repo.purgeExpired(new Date('2031-01-01'))],
  ])('leaves no copy of the ciphertext in the WAL after %s', async (_name, remove) => {
    const db = new PGlite()
    const repo = makeRepo({ db })
    const created = await repo.create({ ...ada, expiresAt: new Date('2030-01-01') })
    const { rows } = await db.query<{ notes_enc: Uint8Array }>(
      'SELECT notes_enc FROM members WHERE id = $1',
      [created.id],
    )
    const ciphertext = Buffer.from(rows[0]!.notes_enc)
    // Positive control: the WAL really holds the bytes before the removal.
    expect(filesHolding(await dump(db), ciphertext).some((f) => f.includes('pg_wal'))).toBe(true)

    await remove(repo, created.id)

    // No manual CHECKPOINT here: the repository itself must have cleaned up.
    expect(filesHolding(await dump(db), ciphertext)).toEqual([])
  })

  it('pages through back-to-back creates in insertion order, with no repeats', async () => {
    const repo = makeRepo()
    const ids: string[] = []
    for (let i = 0; i < 12; i++) {
      ids.push((await repo.create({ ...ada, displayName: `Member ${i}` })).id)
    }

    expect(await pageAll(repo, { limit: 5, orderBy: 'createdAt' })).toEqual(ids)
    expect(await pageAll(repo, { limit: 5, orderBy: 'createdAt', orderDirection: 'desc' })).toEqual(
      [...ids].reverse(),
    )
  })

  it('pages by expiresAt with never-expiring members first', async () => {
    const repo = makeRepo()
    const never = [
      (await repo.create({ ...ada, expiresAt: null })).id,
      (await repo.create({ ...ada, expiresAt: null })).id,
      (await repo.create({ ...ada, expiresAt: null })).id,
    ]
    const later = (await repo.create({ ...ada, expiresAt: new Date('2031-01-01T00:00:00Z') })).id
    const sooner = (await repo.create({ ...ada, expiresAt: new Date('2030-01-01T00:00:00Z') })).id

    expect(await pageAll(repo, { limit: 2, orderBy: 'expiresAt' })).toEqual([
      ...never,
      sooner,
      later,
    ])
  })

  it('closes the database even when opening it failed', async () => {
    const db = new PGlite()
    const repo = new PGliteRepository({
      keyRing,
      db,
      migrations: [{ version: 1, name: 'broken', sql: 'SELECT * FROM no_such_table' }],
    })

    await expect(repo.ready()).rejects.toThrow()
    await repo.close()
    expect(db.closed).toBe(true)
  })

  it('treats an absent optional field like null', async () => {
    const repo = makeRepo()
    const { email: _email, ...withoutEmail } = ada
    void _email

    const created = await repo.create(withoutEmail as typeof ada)

    expect(created.email).toBeNull()
  })

  it('refuses to import into a store that already has members', async () => {
    const source = makeRepo()
    await source.create(ada)
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })

    await expect(
      source.importEncrypted(bundle, { passphrase: 'export passphrase, not real' }),
    ).rejects.toThrow(/empty store/)
  })

  it('fails cleanly on a wrong export passphrase', async () => {
    const source = makeRepo()
    await source.create(ada)
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })

    await expect(
      makeRepo().importEncrypted(bundle, { passphrase: 'wrong passphrase' }),
    ).rejects.toBeInstanceOf(UnlockError)
  })

  it('keeps ids and timestamps across export and import', async () => {
    const source = makeRepo()
    const created = await source.create({ ...ada, expiresAt: new Date('2030-01-01T00:00:00Z') })
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })

    const target = makeRepo()
    await target.importEncrypted(bundle, { passphrase: 'export passphrase, not real' })

    expect(await target.read(created.id)).toEqual(created)
  })

  it('writes no sensitive value into the bundle in plaintext', async () => {
    const source = makeRepo()
    await source.create(ada)
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })

    const hay = Buffer.from(bundle).toString('latin1')
    for (const value of Object.values(ada)) {
      expect(hay).not.toContain(value)
    }
  })

  it('rejects a short export passphrase with ExportPassphraseTooShortError', async () => {
    await expect(makeRepo().exportEncrypted({ passphrase: 'too short' })).rejects.toBeInstanceOf(
      ExportPassphraseTooShortError,
    )
  })

  it('rejects a bundle with a bumped format version before touching the store', async () => {
    const source = makeRepo()
    await source.create(ada)
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })
    bundle[7] = 2

    const target = makeRepo()
    await expect(
      target.importEncrypted(bundle, { passphrase: 'export passphrase, not real' }),
    ).rejects.toBeInstanceOf(BundleVersionError)
    expect((await target.list()).items).toEqual([])
  })

  it('re-encrypts imported rows under the receiving store', async () => {
    const sourceDb = new PGlite()
    const targetDb = new PGlite()
    const source = makeRepo({ db: sourceDb })
    const created = await source.create(ada)
    const bundle = await source.exportEncrypted({ passphrase: 'export passphrase, not real' })
    const target = makeRepo({ db: targetDb })
    await target.importEncrypted(bundle, { passphrase: 'export passphrase, not real' })

    const query = `SELECT ${encryptedColumn('displayName')} AS v FROM members WHERE id = $1`
    const [a, b] = await Promise.all(
      [sourceDb, targetDb].map(
        async (db) => (await db.query<{ v: Uint8Array }>(query, [created.id])).rows[0]!.v,
      ),
    )
    expect(Buffer.from(a!).equals(Buffer.from(b!))).toBe(false)
  })
})

async function pageAll(repo: PGliteRepository, query: ListQuery): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | null = null
  do {
    const page: Page<Member> = await repo.list({ ...query, cursor })
    ids.push(...page.items.map((m) => m.id))
    cursor = page.nextCursor
  } while (cursor !== null)
  return ids
}

async function dump(db: PGlite): Promise<Buffer> {
  return Buffer.from(await (await db.dumpDataDir('none')).arrayBuffer())
}

/** Names of the files in an uncompressed tar whose contents include `needle`. */
function filesHolding(tar: Buffer, needle: Buffer): string[] {
  const found: string[] = []
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString('utf-8').replace(/\0.*$/s, '')
    if (!name) {
      break
    }
    const size = parseInt(
      header.subarray(124, 136).toString('utf-8').replace(/\0.*$/s, '').trim() || '0',
      8,
    )
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (body.includes(needle)) {
      found.push(name)
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return found
}
