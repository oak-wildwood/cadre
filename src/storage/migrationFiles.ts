/**
 * Node-only loader for `migrations/*.sql` (uses `node:fs`). Used by tests
 * now and by the Phase 2 server migration path later — the point of
 * numbered SQL files on disk is that both PGlite and `pg` run the exact
 * same bytes through `migrate()` (see docs/decisions/0006-migrations.md).
 * Never import this from browser-bundled code.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Migration } from './migrate'

const FILENAME_PATTERN = /^(\d+)_(.+)\.sql$/

/** Parses `0001_init.sql` into `{ version: 1, name: "init" }`. */
export function parseMigrationFilename(filename: string): Pick<Migration, 'version' | 'name'> {
  const match = FILENAME_PATTERN.exec(filename)
  if (!match) {
    throw new Error(`Migration filename doesn't match NNNN_slug.sql: ${filename}`)
  }
  const [, version, name] = match
  return { version: Number(version), name: name! }
}

/** Reads every `*.sql` file in `dir` into `Migration` records, unordered. */
export function loadMigrationsFromDisk(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((filename) => filename.endsWith('.sql'))
    .map((filename) => ({
      ...parseMigrationFilename(filename),
      sql: readFileSync(join(dir, filename), 'utf-8'),
    }))
}
