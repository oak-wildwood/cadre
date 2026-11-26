/**
 * Browser-side loader for `migrations/*.sql`. Vite inlines the files at build time, so the app
 * runs the same bytes through `migrate()` as the Node loader in `migrationFiles.ts` does
 * (docs/decisions/0006-migrations.md).
 */
import { parseMigrationFilename, type Migration } from './migrate'

const FILES = import.meta.glob<string>('../../migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const BUNDLED_MIGRATIONS: Migration[] = Object.entries(FILES).map(([path, sql]) => ({
  ...parseMigrationFilename(path.slice(path.lastIndexOf('/') + 1)),
  sql,
}))
