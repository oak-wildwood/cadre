// @vitest-environment node
// Record 0007, decision 12, test 25: automates #11's manual "DevTools shows only ciphertext"
// check by searching a raw dump of the PGlite data directory for every fixture value.
import { PGlite } from '@electric-sql/pglite'
import { createPassphraseSlot, MIN_KDF_PARAMS, type KeyRing } from 'keyslot'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BLIND_INDEXED_FIELDS,
  SENSITIVE_FIELD_NAMES,
  blindIndexColumn,
  encryptedColumn,
} from '../domain/sensitiveFields'
import { migrate } from '../storage/migrate'
import { loadMigrationsFromDisk } from '../storage/migrationFiles'
import {
  decryptMemberFields,
  encryptMemberFields,
  newMemberId,
  type EncryptedValues,
  type SensitiveValues,
} from './memberFields'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS = loadMigrationsFromDisk(join(HERE, '..', '..', 'migrations'))

// Obviously fake, and distinctive enough that a match can only come from these rows.
const FIXTURES: SensitiveValues[] = [
  {
    displayName: 'Quillfeather Fixturename',
    email: 'quillfeather.fixture@example.invalid',
    phone: '+1-555-0142-7731',
    role: 'zz-fixture-organizer',
    notes: 'Fixture note: met at the marmalade-otter planning session.',
  },
  {
    displayName: 'Brambleworth Testperson',
    email: 'brambleworth.test@example.invalid',
    phone: '+1-555-0199-2468',
    role: 'zz-fixture-member',
    notes: null,
  },
]

/**
 * Stand-in for #12's blind index, which owns normalization. Only here so the NOT NULL
 * `display_name_bidx` column can be filled; it is an HMAC, never the value.
 */
async function testBlindIndex(keyRing: KeyRing, value: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(value.normalize('NFC').toLowerCase())
  return new Uint8Array(await crypto.subtle.sign('HMAC', keyRing.blindIndexKey, data))
}

function contains(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, 'utf-8'))
}

describe('raw store dump', () => {
  let db: PGlite

  beforeEach(async () => {
    db = new PGlite()
    await migrate(async (sql) => {
      const results = await db.exec(sql)
      return results[results.length - 1] ?? { rows: [] }
    }, MIGRATIONS)
  })

  afterEach(async () => {
    await db.close()
  })

  it('contains none of the fixture names, emails, phones, roles or notes', async () => {
    const { slot, keyRing } = await createPassphraseSlot('fixture passphrase, not real', {
      kdf: MIN_KDF_PARAMS,
    })
    await db.query('INSERT INTO key_slots (slot) VALUES ($1)', [slot])

    const ids: string[] = []
    for (const fixture of FIXTURES) {
      const id = newMemberId()
      ids.push(id)
      const encrypted = await encryptMemberFields(keyRing, id, fixture)
      const columns = ['id', ...SENSITIVE_FIELD_NAMES.map(encryptedColumn)]
      const values: unknown[] = [id, ...SENSITIVE_FIELD_NAMES.map((f) => encrypted[f])]
      for (const field of BLIND_INDEXED_FIELDS) {
        const value = fixture[field]
        columns.push(blindIndexColumn(field))
        values.push(value === null ? null : await testBlindIndex(keyRing, value))
      }
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
      await db.query(`INSERT INTO members (${columns.join(', ')}) VALUES (${placeholders})`, values)
    }

    // Positive control: plaintext written the same way must show up, or the search is blind.
    const canary = 'canary-plaintext-7f3a9c'
    await db.exec(`CREATE TABLE dump_canary (v text); INSERT INTO dump_canary VALUES ('${canary}')`)
    await db.exec('CHECKPOINT')

    const dump = new Uint8Array(await (await db.dumpDataDir('none')).arrayBuffer())

    expect(contains(dump, canary)).toBe(true)
    for (const fixture of FIXTURES) {
      for (const value of Object.values(fixture)) {
        if (value !== null) {
          expect(contains(dump, value), `plaintext in dump: ${value}`).toBe(false)
        }
      }
    }

    // And the rows are real ciphertext of the fixtures, not something that merely isn't them.
    for (const [index, id] of ids.entries()) {
      const { rows } = await db.query<Record<string, Uint8Array | null>>(
        `SELECT ${SENSITIVE_FIELD_NAMES.map(encryptedColumn).join(', ')} FROM members WHERE id = $1`,
        [id],
      )
      const row = rows[0]!
      const encrypted = Object.fromEntries(
        SENSITIVE_FIELD_NAMES.map((f) => [f, row[encryptedColumn(f)] ?? null]),
      ) as EncryptedValues
      expect(await decryptMemberFields(keyRing, id, encrypted)).toEqual(FIXTURES[index])
    }
  })
})
