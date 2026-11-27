/**
 * Reads and writes the wrapped master key (`key_slots`, record 0007 decision 9) in the same
 * database as the ledger. The repository can't do this itself: it needs an unlocked `KeyRing`,
 * and the slot is what produces one. So the app opens the database here, unlocks with the slot,
 * then hands the already-open database to `PGliteRepository` via its `db` option.
 *
 * A slot is ciphertext and public Argon2id settings only; it holds nothing that unlocks the
 * data without the passphrase. This module never sees a passphrase or a key.
 */
import { PGlite } from '@electric-sql/pglite'

import { BUNDLED_MIGRATIONS } from './bundledMigrations'
import { migrate, type Migration } from './migrate'

export interface KeySlotStoreOptions {
  /** `idb://<name>` in the browser, a directory in Node, `undefined` for in-memory. */
  dataDir?: string
  migrations?: Migration[]
}

export class KeySlotStore {
  private constructor(readonly db: PGlite) {}

  /** Opens the database and brings the schema current, so `key_slots` exists. */
  static async open(options: KeySlotStoreOptions = {}): Promise<KeySlotStore> {
    const db = new PGlite(options.dataDir)
    try {
      await migrate(async (sql) => {
        const results = await db.exec(sql)
        return results[results.length - 1] ?? { rows: [] }
      }, options.migrations ?? BUNDLED_MIGRATIONS)
    } catch (error) {
      await db.close().catch(() => {})
      throw error
    }
    return new KeySlotStore(db)
  }

  /** The passphrase slot, or `null` on a store that has never been set up. */
  async readSlot(): Promise<Uint8Array | null> {
    const { rows } = await this.db.query<{ slot: Uint8Array }>(
      'SELECT slot FROM key_slots ORDER BY created_at, id LIMIT 1',
    )
    return rows[0] ? new Uint8Array(rows[0].slot) : null
  }

  /** Stores the first slot, or replaces the existing one (a re-wrap keeps the same master key). */
  async writeSlot(slot: Uint8Array): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        'SELECT id FROM key_slots ORDER BY created_at, id LIMIT 1 FOR UPDATE',
      )
      if (rows[0]) {
        await tx.query('UPDATE key_slots SET slot = $1, updated_at = now() WHERE id = $2', [
          slot,
          rows[0].id,
        ])
      } else {
        await tx.query('INSERT INTO key_slots (slot) VALUES ($1)', [slot])
      }
    })
  }

  async close(): Promise<void> {
    if (!this.db.closed) {
      await this.db.close()
    }
  }
}
