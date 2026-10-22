// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

import { migrate, toMigrations, type QueryFn } from './migrate'
import { migrations } from './migrations'

function queryFor(db: PGlite): QueryFn {
  return async (sql) => (await db.exec(sql)).at(-1)?.rows ?? []
}

describe('migrate', () => {
  it('applies migrations once; a second run is a no-op', async () => {
    const q = queryFor(new PGlite())
    expect(await migrate(q, migrations)).toEqual([1])
    expect(await migrate(q, migrations)).toEqual([])
    expect(await q('SELECT version, name FROM schema_migrations')).toEqual([
      { version: 1, name: 'init' },
    ])
  })

  it('creates members and settings with the expected indexes', async () => {
    const q = queryFor(new PGlite())
    await migrate(q, migrations)
    const idx = await q("SELECT indexname FROM pg_indexes WHERE tablename = 'members'")
    const names = idx.map((r) => r.indexname)
    for (const n of [
      'members_expires_at_idx',
      'members_display_name_bidx_idx',
      'members_email_bidx_idx',
      'members_phone_bidx_idx',
    ]) {
      expect(names).toContain(n)
    }
    await q('SELECT * FROM settings')
  })

  it('applies later migrations in version order, regardless of input order', async () => {
    const q = queryFor(new PGlite())
    await migrate(q, migrations)
    const extra = toMigrations({
      '/m/0003_third.sql': "INSERT INTO settings (key, value) SELECT 'n', to_jsonb(count(*)) FROM t2;",
      '/m/0002_second.sql': 'CREATE TABLE t2 (id int); INSERT INTO t2 VALUES (1);',
    })
    expect(await migrate(q, [...migrations, ...extra])).toEqual([2, 3])
    expect(await q("SELECT value FROM settings WHERE key = 'n'")).toEqual([{ value: 1 }])
  })

  it('rolls back a failing migration and does not record it', async () => {
    const q = queryFor(new PGlite())
    const bad = toMigrations({ '0001_bad.sql': 'CREATE TABLE a (id int); SELECT nope();' })
    await expect(migrate(q, bad)).rejects.toThrow()
    expect(await q('SELECT version FROM schema_migrations')).toEqual([])
    await expect(q('SELECT * FROM a')).rejects.toThrow()
  })

  it('rejects duplicate versions and renamed applied migrations', async () => {
    const q = queryFor(new PGlite())
    const dup = [
      { version: 1, name: 'a', sql: 'SELECT 1' },
      { version: 1, name: 'b', sql: 'SELECT 1' },
    ]
    await expect(migrate(q, dup)).rejects.toThrow(/duplicate/)
    await migrate(q, migrations)
    await expect(migrate(q, [{ ...migrations[0], name: 'other' }])).rejects.toThrow(/applied as/)
  })
})
