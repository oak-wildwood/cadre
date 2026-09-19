import type { Member, MemberId, MemberPatch, NewMember, SensitiveField } from './member'
import type { ListQuery, Page } from './listQuery'

export interface ExportOptions {
  /** Passphrase the export bundle is encrypted under; never the org's stored key material. */
  passphrase: string
}

export interface ImportOptions {
  /** Passphrase the bundle being imported was exported with. */
  passphrase: string
}

export interface PurgeResult {
  purged: number
}

export interface ImportResult {
  imported: number
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
   * invariant.
   */
  findByBlindIndex(field: SensitiveField, value: string): Promise<Member[]>

  /** Crypto-shreds every member whose `expiresAt` is at or before `now` (default: `new Date()`). */
  purgeExpired(now?: Date): Promise<PurgeResult>

  /** Encrypted by default — see AGENTS.md's "exports are encrypted by default" invariant. */
  exportEncrypted(opts: ExportOptions): Promise<Uint8Array>

  /** Imports into the calling repository; must round-trip into a *fresh* repository. */
  importEncrypted(bundle: Uint8Array, opts: ImportOptions): Promise<ImportResult>
}
