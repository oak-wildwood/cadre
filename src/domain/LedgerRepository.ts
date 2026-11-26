import type { BlindIndexedField, Member, MemberId, MemberPatch, NewMember } from './member'
import type { ListQuery, Page } from './listQuery'

export interface ExportOptions {
  /**
   * Passphrase the export bundle is encrypted under; never the org's stored key material. At
   * least 15 characters (record 0010, decision 3).
   */
  passphrase: string
  /** Members expired at or before this instant are left out. Defaults to `new Date()`. */
  now?: Date
}

export interface ImportOptions {
  /** Passphrase the bundle being imported was exported with. */
  passphrase: string
  /**
   * Import refuses a store that has members unless this is `true`, in which case every existing
   * member is deleted and the bundle written in one transaction. There is no merge.
   */
  replace?: boolean
  /** Members expired at or before this instant are skipped. Defaults to `new Date()`. */
  now?: Date
}

export interface PurgeResult {
  purged: number
}

export interface ImportResult {
  imported: number
  /** Rows in the bundle already past their `expiresAt`, which were not imported. */
  skippedExpired: number
}

/** `importEncrypted` was called on a store with members and without `replace: true`. */
export class StoreNotEmptyError extends Error {
  constructor() {
    super('Import needs an empty store, or replace: true to delete the existing members first.')
    this.name = 'StoreNotEmptyError'
  }
}

/**
 * The migration boundary between the browser (PGlite) and server (Postgres)
 * storage adapters. UI and domain logic depend only on this interface, never
 * on a concrete adapter — see AGENTS.md rule 5 and
 * docs/decisions/0005-repository-interface.md.
 *
 * Every implementation must pass `repository.contract.spec.ts` unchanged.
 */
export interface LedgerRepository {
  create(input: NewMember): Promise<Member>
  read(id: MemberId): Promise<Member | null>
  update(id: MemberId, patch: MemberPatch): Promise<Member>
  delete(id: MemberId): Promise<void>

  /** Pagination and filtering are restricted to non-sensitive fields — see `ListQuery`. */
  list(query?: ListQuery): Promise<Page<Member>>

  /**
   * Equality-only lookup against a blind index (HMAC of the normalized
   * value). Never partial or prefix matching — see AGENTS.md's blind-index
   * invariant. Only `BLIND_INDEXED_FIELDS` (see `sensitiveFields.ts`) can be searched.
   */
  findByBlindIndex(field: BlindIndexedField, value: string): Promise<Member[]>

  /** Crypto-shreds every member whose `expiresAt` is at or before `now` (default: `new Date()`). */
  purgeExpired(now?: Date): Promise<PurgeResult>

  /**
   * Always encrypted: there is no plaintext export (record 0010). Format in
   * `docs/export-format.md`. Expired members are left out.
   */
  exportEncrypted(opts: ExportOptions): Promise<Uint8Array>

  /**
   * Imports into the calling repository; must round-trip into a *fresh* repository. Replace-only:
   * throws `StoreNotEmptyError` on a store with members unless `replace: true`.
   */
  importEncrypted(bundle: Uint8Array, opts: ImportOptions): Promise<ImportResult>
}
