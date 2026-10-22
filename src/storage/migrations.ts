import { toMigrations } from './migrate'

/** All SQL files under `migrations/`, the same ones server Postgres will run. */
export const migrations = toMigrations(
  import.meta.glob('../../migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
