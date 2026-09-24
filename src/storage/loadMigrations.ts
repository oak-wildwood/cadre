import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Migration } from './migrate'

/**
 * Reads `NNNN_<slug>.sql` files from disk. Node-only (`node:fs`) — kept out of `migrate.ts`
 * so that file stays safe to bundle into the browser, where migrations will need to be
 * loaded a different way (e.g. bundled as strings at build time). Server (`pg`) and test
 * code can both use this directly.
 */
const MIGRATION_FILE = /^(\d+)_([a-z0-9-]+)\.sql$/

export function loadMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .flatMap((file) => {
      const match = MIGRATION_FILE.exec(file)
      return match ? [{ file, version: match[1]!, name: match[2]! }] : []
    })
    .sort((a, b) => a.version.localeCompare(b.version))
    .map(({ file, version, name }) => ({
      version,
      name,
      sql: readFileSync(join(dir, file), 'utf8'),
    }))
}
