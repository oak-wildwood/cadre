// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadMigrations, migrate } from './migrate'
import type { Migration, Query } from './migrate'

const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url))

describe('migrate', () => {
  let db: PGlite
  let query: Query

  beforeEach(() => {
    db = new PGlite()
    // db.query() only accepts a single statement; a migration body can have
    // several, so route through exec() (the "simple query" protocol) and
    // report the rows of its last statement, matching the `Query` contract.
    query = async (sql) => {
      const results = await db.exec(sql)
      return results.at(-1) ?? { rows: [] }
    }
  })

  afterEach(async () => {
    await db.close()
  })

  it('applies 0001_init.sql and creates the expected tables and indexes', async () => {
    const migrations = loadMigrations(migrationsDir)
    expect(migrations.map((m) => m.version)).toEqual(['0001'])

    const applied = await migrate(query, migrations)

    expect(applied.map((m) => m.version)).toEqual(['0001'])

    const { rows: tables } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    expect(tables.map((t) => t.table_name)).toEqual(['members', 'schema_migrations', 'settings'])

    const { rows: indexes } = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'members' order by indexname`,
    )
    expect(indexes.map((i) => i.indexname)).toEqual(
      [
        'members_display_name_bidx_idx',
        'members_email_bidx_idx',
        'members_expires_at_idx',
        'members_notes_bidx_idx',
        'members_pkey',
        'members_phone_bidx_idx',
      ].sort(),
    )
  })

  it('is idempotent: running the same migrations twice applies nothing the second time', async () => {
    const migrations = loadMigrations(migrationsDir)

    const firstRun = await migrate(query, migrations)
    expect(firstRun.map((m) => m.version)).toEqual(['0001'])

    const secondRun = await migrate(query, migrations)
    expect(secondRun).toEqual([])

    const { rows } = await db.query('select version from schema_migrations')
    expect(rows).toHaveLength(1)
  })

  it('applies a later migration in version order on top of an already-applied one', async () => {
    const initMigration = loadMigrations(migrationsDir)[0]!
    const dummyMigration: Migration = {
      version: '0002',
      name: 'dummy',
      sql: 'create table dummy_marker (id integer primary key)',
    }

    const firstRun = await migrate(query, [initMigration])
    expect(firstRun.map((m) => m.version)).toEqual(['0001'])

    const secondRun = await migrate(query, [dummyMigration, initMigration])
    expect(secondRun.map((m) => m.version)).toEqual(['0002'])

    const { rows } = await db.query('select version from schema_migrations order by version')
    expect(rows).toEqual([
      { version: '0001', name: 'init', applied_at: expect.anything() },
      { version: '0002', name: 'dummy', applied_at: expect.anything() },
    ])

    const { rows: dummyTable } = await db.query(
      `select table_name from information_schema.tables where table_name = 'dummy_marker'`,
    )
    expect(dummyTable).toHaveLength(1)
  })

  it('rejects a migration whose version/name has characters outside the safe set', async () => {
    const malicious: Migration = {
      version: '0001',
      name: "x'); drop table members; --",
      sql: 'select 1',
    }

    await expect(migrate(query, [malicious])).rejects.toThrow(/invalid migration/i)
  })
})

describe('loadMigrations', () => {
  it('loads migrations from disk sorted by version', () => {
    const migrations = loadMigrations(migrationsDir)

    expect(migrations).toEqual([
      { version: '0001', name: 'init', sql: expect.stringContaining('create table members') },
    ])
  })

  it('ignores files that do not match the NNNN_<slug>.sql pattern', () => {
    const migrations = loadMigrations(join(migrationsDir, '..', 'docs', 'decisions'))
    expect(migrations).toEqual([])
  })
})
