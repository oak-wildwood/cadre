// @vitest-environment node
//
// PGlite needs a real WASM-capable runtime; happy-dom (this project's
// default test environment, see docs/dev.md) doesn't provide one. Plain
// Node does, so this file overrides to the `node` environment rather than
// pulling in Vitest browser mode — nothing here depends on running inside
// an actual browser (no IndexedDB persistence, no DOM).
import { readFileSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrate, type Migration, type QueryFn } from './migrate'

describe('migrate', () => {
  let db: PGlite
  let query: QueryFn

  beforeEach(() => {
    db = new PGlite()
    query = (sql) => db.exec(sql)
  })

  it('applies pending migrations and records them in schema_migrations', async () => {
    const migrations: Migration[] = [
      { version: 1, name: '0001_widgets', sql: 'CREATE TABLE widgets (id integer PRIMARY KEY);' },
    ]

    const result = await migrate(query, migrations)

    expect(result.applied).toEqual(['0001_widgets'])
    const { rows } = await db.query<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version',
    )
    expect(rows).toEqual([{ version: 1, name: '0001_widgets' }])
  })

  it('is idempotent: running the same list twice applies nothing the second time', async () => {
    const migrations: Migration[] = [
      { version: 1, name: '0001_widgets', sql: 'CREATE TABLE widgets (id integer PRIMARY KEY);' },
    ]

    await migrate(query, migrations)
    const second = await migrate(query, migrations)

    expect(second.applied).toEqual([])
    const { rows } = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM schema_migrations',
    )
    expect(rows).toEqual([{ count: 1 }])
  })

  it('applies migrations in ascending version order regardless of array order', async () => {
    // 0002 reads a table 0001 creates; if the runner applied 0002 first
    // this would fail with "relation widgets does not exist".
    const migrations: Migration[] = [
      {
        version: 2,
        name: '0002_seed_widgets',
        sql: "INSERT INTO widgets (id, label) VALUES (1, 'first');",
      },
      {
        version: 1,
        name: '0001_widgets',
        sql: 'CREATE TABLE widgets (id integer PRIMARY KEY, label text NOT NULL);',
      },
    ]

    const result = await migrate(query, migrations)

    expect(result.applied).toEqual(['0001_widgets', '0002_seed_widgets'])
    const { rows } = await db.query<{ id: number; label: string }>('SELECT id, label FROM widgets')
    expect(rows).toEqual([{ id: 1, label: 'first' }])
  })

  it('applies only newly added migrations on a later call', async () => {
    const widgets: Migration = {
      version: 1,
      name: '0001_widgets',
      sql: 'CREATE TABLE widgets (id integer PRIMARY KEY);',
    }
    await migrate(query, [widgets])

    const gadgets: Migration = {
      version: 2,
      name: '0002_gadgets',
      sql: 'CREATE TABLE gadgets (id integer PRIMARY KEY);',
    }
    const result = await migrate(query, [widgets, gadgets])

    expect(result.applied).toEqual(['0002_gadgets'])
  })

  it('rejects duplicate migration versions', async () => {
    const migrations: Migration[] = [
      { version: 1, name: '0001_a', sql: 'CREATE TABLE a (id integer PRIMARY KEY);' },
      { version: 1, name: '0001_b', sql: 'CREATE TABLE b (id integer PRIMARY KEY);' },
    ]

    await expect(migrate(query, migrations)).rejects.toThrow(/duplicate/i)
  })

  it('applies the real 0001_init.sql migration', async () => {
    const sql = readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8')
    const migrations: Migration[] = [{ version: 1, name: '0001_init', sql }]

    const result = await migrate(query, migrations)

    expect(result.applied).toEqual(['0001_init'])
    const { rows: tables } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables ` +
        `WHERE table_schema = 'public' ORDER BY table_name`,
    )
    expect(tables.map((row) => row.table_name)).toEqual(['members', 'settings'])

    const { rows: indexes } = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes ` +
        `WHERE schemaname = 'public' AND tablename = 'members' ORDER BY indexname`,
    )
    expect(indexes.map((row) => row.indexname)).toEqual([
      'members_display_name_bidx_idx',
      'members_email_bidx_idx',
      'members_expires_at_idx',
      'members_notes_bidx_idx',
      'members_phone_bidx_idx',
      'members_pkey',
    ])
  })
})
