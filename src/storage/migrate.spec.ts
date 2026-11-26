import { PGlite } from '@electric-sql/pglite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BLIND_INDEXED_FIELDS,
  SENSITIVE_FIELD_NAMES,
  blindIndexColumn,
  encryptedColumn,
} from '../domain/sensitiveFields'
import { migrate, type Migration, type QueryFn } from './migrate'
import { loadMigrationsFromDisk, parseMigrationFilename } from './migrationFiles'

const HERE = dirname(fileURLToPath(import.meta.url))
const DISK_MIGRATIONS = loadMigrationsFromDisk(join(HERE, '..', '..', 'migrations'))

// Derived from sensitiveFields.ts, so a new sensitive field fails these assertions until a
// migration adds its `_enc` column (and `_bidx` column and index, if it is blind-indexed).
const ENC_COLUMNS = SENSITIVE_FIELD_NAMES.map(encryptedColumn)
const BIDX_COLUMNS = BLIND_INDEXED_FIELDS.map(blindIndexColumn)
const ALL_VERSIONS = DISK_MIGRATIONS.map((m) => m.version).sort((a, b) => a - b)

describe('migrate', () => {
  let db: PGlite
  let query: QueryFn

  beforeEach(() => {
    db = new PGlite()
    query = async (sql) => {
      const results = await db.exec(sql)
      return results[results.length - 1] ?? { rows: [] }
    }
  })

  afterEach(async () => {
    await db.close()
  })

  it('applies every migration on disk, in order', async () => {
    const result = await migrate(query, DISK_MIGRATIONS)

    expect(ALL_VERSIONS).toEqual([1, 2])
    expect(result.applied.map((m) => m.version)).toEqual(ALL_VERSIONS)
  })

  it('leaves members with only structural columns and the derived `_enc` / `_bidx` columns', async () => {
    await migrate(query, DISK_MIGRATIONS)

    const { rows: memberColumns } = await query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'members'
    `)
    const columnNames = memberColumns.map((row) => row.column_name).sort()
    expect(columnNames).toEqual(
      ['id', 'created_at', 'updated_at', 'expires_at', ...ENC_COLUMNS, ...BIDX_COLUMNS].sort(),
    )
    // Record 0007, decision 9: no plaintext role, no role or notes blind index.
    expect(columnNames).not.toContain('role')
    expect(columnNames).not.toContain('role_bidx')
    expect(columnNames).not.toContain('notes_bidx')

    const { rows: settingsRows } = await query(`SELECT * FROM settings`)
    expect(settingsRows).toEqual([])
  })

  it('indexes expires_at and every blind-index column, and nothing encrypted', async () => {
    await migrate(query, DISK_MIGRATIONS)

    const { rows } = await query(`SELECT indexdef FROM pg_indexes WHERE tablename = 'members'`)
    const indexedColumns = rows.map((row) => /\((\w+)\)$/.exec(String(row.indexdef))?.[1])

    expect(indexedColumns.sort()).toEqual(['expires_at', 'id', ...BIDX_COLUMNS].sort())
  })

  it('makes the member id a required, client-supplied value', async () => {
    await migrate(query, DISK_MIGRATIONS)

    // The id is part of every value's AAD, so a database-made id would be a bug.
    await expect(
      query(`INSERT INTO members (display_name_enc, display_name_bidx) VALUES ('\\x01', '\\x01')`),
    ).rejects.toThrow(/null value in column "id"/)
  })

  it('creates key_slots for wrapped master keys', async () => {
    await migrate(query, DISK_MIGRATIONS)

    const { rows } = await query(`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'key_slots' ORDER BY column_name
    `)
    expect(rows).toEqual([
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'slot', data_type: 'bytea', is_nullable: 'NO' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
    ])
    await expect(query(`INSERT INTO key_slots (slot) VALUES ('\\x')`)).rejects.toThrow()
  })

  it('running the migrations twice is a no-op the second time', async () => {
    const first = await migrate(query, DISK_MIGRATIONS)
    expect(first.applied.map((m) => m.version)).toEqual(ALL_VERSIONS)

    const second = await migrate(query, DISK_MIGRATIONS)
    expect(second.applied).toEqual([])

    const { rows } = await query(`SELECT version FROM schema_migrations ORDER BY version`)
    expect(rows.map((r) => r.version)).toEqual(ALL_VERSIONS)
  })

  it('applies migrations in version order regardless of input order, proven by a dummy migration', async () => {
    // This migration only succeeds if `members` already exists, so it
    // proves 0001 really ran before it rather than merely being recorded
    // in the returned order.
    const dummyMigration: Migration = {
      version: 2,
      name: 'dummy_depends_on_members',
      sql: `ALTER TABLE members ADD COLUMN dummy_marker boolean NOT NULL DEFAULT true;`,
    }
    const initMigration = DISK_MIGRATIONS.find((m) => m.version === 1)!

    // Passed in reverse order on purpose.
    const result = await migrate(query, [dummyMigration, initMigration])

    expect(result.applied.map((m) => m.version)).toEqual([1, 2])

    const { rows } = await query(`SELECT dummy_marker FROM members`)
    expect(rows).toEqual([])

    const { rows: recorded } = await query(
      `SELECT version, name FROM schema_migrations ORDER BY version`,
    )
    expect(recorded).toEqual([
      { version: 1, name: 'init' },
      { version: 2, name: 'dummy_depends_on_members' },
    ])
  })

  it('rolls back a failing migration, leaves it unrecorded, and keeps the connection usable', async () => {
    const broken: Migration = {
      version: 1,
      name: 'broken',
      sql: `CREATE TABLE half_done (id integer); SELECT * FROM table_that_does_not_exist;`,
    }

    await expect(migrate(query, [broken])).rejects.toThrow()

    const { rows: tables } = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'half_done'`,
    )
    expect(tables).toEqual([])

    const retry = await migrate(query, DISK_MIGRATIONS)
    expect(retry.applied.map((m) => m.version)).toEqual(ALL_VERSIONS)
  })

  it('rejects duplicate versions', async () => {
    const migrations: Migration[] = [
      { version: 1, name: 'a', sql: 'SELECT 1' },
      { version: 1, name: 'b', sql: 'SELECT 1' },
    ]

    await expect(migrate(query, migrations)).rejects.toThrow(/duplicate/i)
  })

  it.each([
    { version: 1, name: "init'); DROP TABLE members; --" },
    { version: 1, name: 'Has-Caps' },
    { version: 0, name: 'zero' },
    { version: 1.5, name: 'fractional' },
    { version: Number.NaN, name: 'nan' },
  ])('rejects an unsafe version or name before running any SQL: %o', async (bad) => {
    await expect(migrate(query, [{ ...bad, sql: 'SELECT 1' }])).rejects.toThrow(
      /invalid migration/i,
    )

    const { rows } = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'schema_migrations'`,
    )
    expect(rows).toEqual([])
  })
})

describe('parseMigrationFilename', () => {
  it('parses version and name from NNNN_slug.sql', () => {
    expect(parseMigrationFilename('0001_init.sql')).toEqual({ version: 1, name: 'init' })
    expect(parseMigrationFilename('0012_add_role_index.sql')).toEqual({
      version: 12,
      name: 'add_role_index',
    })
  })

  it('rejects filenames that do not match the pattern', () => {
    expect(() => parseMigrationFilename('init.sql')).toThrow()
  })
})
