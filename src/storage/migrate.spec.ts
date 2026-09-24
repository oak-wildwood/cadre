import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadMigrations } from './loadMigrations'
import { migrate, type Query } from './migrate'

const MIGRATIONS_DIR = join(process.cwd(), 'migrations')

/**
 * Adapter from PGlite's real API to the runner's `Query` type: a call with `params` is a
 * single parameterized statement (`db.query`), a call without is a whole migration file that
 * may contain several `;`-separated statements (`db.exec`, which doesn't take params).
 */
function pgliteQuery(db: PGlite): Query {
  return async (sql, params) => {
    if (params) {
      return db.query(sql, params)
    }
    const results = await db.exec(sql)
    return results.at(-1) ?? { rows: [] }
  }
}

describe('migrate', () => {
  let db: PGlite

  beforeEach(() => {
    db = new PGlite()
  })

  afterEach(async () => {
    await db.close()
  })

  it('applies a second, out-of-order migration only after the first (ordering)', async () => {
    const query = pgliteQuery(db)

    const createWidgets = {
      version: '0001',
      name: 'create_widgets',
      sql: 'create table widgets (id integer primary key)',
    }
    const seedWidget = {
      version: '0002',
      name: 'seed_widget',
      sql: 'insert into widgets (id) values (1)',
    }

    // Passed out of order: if the runner didn't sort by version, the insert into a
    // not-yet-created table would fail.
    const result = await migrate(query, [seedWidget, createWidgets])

    expect(result.applied).toEqual(['0001', '0002'])
    const { rows } = await query<{ id: number }>('select id from widgets')
    expect(rows).toEqual([{ id: 1 }])
  })

  it('applies migrations idempotently: a second run is a no-op', async () => {
    const query = pgliteQuery(db)
    const migrations = loadMigrations(MIGRATIONS_DIR)

    const first = await migrate(query, migrations)
    expect(first.applied).toEqual(['0001'])

    const second = await migrate(query, migrations)
    expect(second.applied).toEqual([])

    const { rows } = await query<{ count: number }>('select count(*) from schema_migrations')
    expect(rows[0]?.count).toBe(1)
  })

  it('0001_init.sql produces a usable members/settings schema', async () => {
    const query = pgliteQuery(db)
    await migrate(query, loadMigrations(MIGRATIONS_DIR))

    const inserted = await query<{
      id: string
      role: string | null
      expires_at: string | null
    }>(
      `insert into members (display_name_enc, display_name_bidx, role)
       values ($1, $2, $3)
       returning id, role, expires_at`,
      [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]), 'organizer'],
    )
    expect(inserted.rows[0]?.role).toBe('organizer')
    expect(inserted.rows[0]?.expires_at).toBeNull()
    expect(inserted.rows[0]?.id).toBeTruthy()

    const settingsInsert = await query<{ id: string }>(
      'insert into settings (default_retention_days) values ($1) returning id',
      [365],
    )
    expect(settingsInsert.rows[0]?.id).toBeTruthy()

    const { rows: indexes } = await query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename = 'members' order by indexname",
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
