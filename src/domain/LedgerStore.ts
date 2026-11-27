import type { LedgerRepository } from './LedgerRepository'

/** Whether a store has been set up yet. Says nothing about its contents. */
export type StoreState = 'new' | 'existing'

/** A store unlocked with its passphrase. Member data goes through `repository` only. */
export interface OpenLedger {
  repository: LedgerRepository
  /**
   * Drops the keys from memory and closes the store. Every later call on `repository` fails.
   * Idempotent.
   */
  lock(): Promise<void>
}

/**
 * The store's lifecycle: find out whether one exists, create it, unlock it. This is the only
 * other thing the UI talks to besides `LedgerRepository` (AGENTS.md rule 5); it hands out a
 * repository and never member data itself.
 *
 * `create` and `unlock` fail with keyslot's `UnlockError` for a wrong passphrase *and* for a
 * damaged store, deliberately alike (record 0007, decision 8), and with
 * `CryptoUnavailableError` when the device can't run the encryption.
 */
export interface LedgerStore {
  probe(): Promise<StoreState>
  /** First run only: makes the key slot. Fails if the store already has one. */
  create(passphrase: string): Promise<OpenLedger>
  unlock(passphrase: string): Promise<OpenLedger>
}

/** `create` was called on a store that already has a key slot. */
export class StoreExistsError extends Error {
  constructor() {
    super('This store has already been set up. Unlock it instead.')
    this.name = 'StoreExistsError'
  }
}
