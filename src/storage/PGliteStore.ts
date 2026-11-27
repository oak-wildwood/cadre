/**
 * `LedgerStore` for the browser store: reads and writes the `key_slots` row, and hands an
 * unlocked `PGliteRepository` to the UI. The passphrase stops here; the repository only ever
 * gets the `KeyRing` (record 0007).
 */
import { PGlite } from '@electric-sql/pglite'
import { createPassphraseSlot, UnlockError, type KdfParams, type KeyRing } from 'keyslot'

import { unlockStore } from '../crypto/unlockStore'
import {
  StoreExistsError,
  type LedgerStore,
  type OpenLedger,
  type StoreState,
} from '../domain/LedgerStore'
import { BUNDLED_MIGRATIONS } from './bundledMigrations'
import { migrate, type Migration } from './migrate'
import { DEFAULT_DATA_DIR, PGliteRepository } from './PGliteRepository'

export interface PGliteStoreOptions {
  /** Opens a fresh connection each time. Defaults to PGlite at `DEFAULT_DATA_DIR`. */
  openDb?: () => PGlite
  migrations?: Migration[]
  /** Argon2id settings for a new store's slot. Defaults to keyslot's defaults; tests lower them. */
  kdf?: KdfParams
  /** Argon2id settings for export bundles, passed to the repository. Tests lower them. */
  exportKdf?: KdfParams
}

export class PGliteStore implements LedgerStore {
  private readonly openDb: () => PGlite
  private readonly migrations: Migration[]
  private readonly kdf: KdfParams | undefined
  private readonly exportKdf: KdfParams | undefined

  constructor(options: PGliteStoreOptions = {}) {
    this.openDb = options.openDb ?? (() => new PGlite(DEFAULT_DATA_DIR))
    this.migrations = options.migrations ?? BUNDLED_MIGRATIONS
    this.kdf = options.kdf
    this.exportKdf = options.exportKdf
  }

  async probe(): Promise<StoreState> {
    const db = await this.connect()
    try {
      return (await readSlot(db)) === null ? 'new' : 'existing'
    } finally {
      await db.close()
    }
  }

  async create(passphrase: string): Promise<OpenLedger> {
    const db = await this.connect()
    let keyRing: KeyRing | null = null
    try {
      const created = await createPassphraseSlot(
        passphrase,
        this.kdf ? { kdf: this.kdf } : undefined,
      )
      keyRing = created.keyRing
      await db.transaction(async (tx) => {
        const { rows } = await tx.query(`SELECT 1 FROM key_slots LIMIT 1`)
        if (rows.length) {
          throw new StoreExistsError()
        }
        await tx.query(`INSERT INTO key_slots (slot) VALUES ($1)`, [created.slot])
      })
      return this.open(db, keyRing)
    } catch (error) {
      keyRing?.lock()
      await closeQuietly(db)
      throw error
    }
  }

  async unlock(passphrase: string): Promise<OpenLedger> {
    const db = await this.connect()
    try {
      const stored = await readSlot(db)
      if (stored === null) {
        // Same error as a wrong passphrase: no hint about what is or isn't on this device.
        throw new UnlockError()
      }
      const { keyRing, upgradedSlot } = await unlockStore(passphrase, stored.slot)
      if (upgradedSlot) {
        try {
          await db.query(`UPDATE key_slots SET slot = $1, updated_at = now() WHERE id = $2`, [
            upgradedSlot,
            stored.id,
          ])
        } catch {
          // Keep the old, still valid slot; the upgrade is retried on the next unlock.
        }
      }
      return this.open(db, keyRing)
    } catch (error) {
      await closeQuietly(db)
      throw error
    }
  }

  private async connect(): Promise<PGlite> {
    const db = this.openDb()
    try {
      await migrate(async (sql) => {
        const results = await db.exec(sql)
        return results[results.length - 1] ?? { rows: [] }
      }, this.migrations)
      return db
    } catch (error) {
      await closeQuietly(db)
      throw error
    }
  }

  private async open(db: PGlite, keyRing: KeyRing): Promise<OpenLedger> {
    const repository = new PGliteRepository({
      db,
      keyRing,
      migrations: this.migrations,
      exportKdf: this.exportKdf,
    })
    try {
      await repository.ready()
    } catch (error) {
      keyRing.lock()
      await repository.close()
      throw error
    }
    let locked: Promise<void> | null = null
    return {
      repository,
      lock: () =>
        (locked ??= (async () => {
          keyRing.lock()
          await repository.close()
        })()),
    }
  }
}

/** The store's key slot. Phase 1 stores have exactly one; the oldest wins if there are more. */
async function readSlot(db: PGlite): Promise<{ id: string; slot: Uint8Array } | null> {
  const { rows } = await db.query<{ id: string; slot: Uint8Array }>(
    `SELECT id, slot FROM key_slots ORDER BY created_at, id LIMIT 1`,
  )
  return rows[0] ?? null
}

async function closeQuietly(db: PGlite): Promise<void> {
  if (!db.closed) {
    await db.close().catch(() => {})
  }
}
