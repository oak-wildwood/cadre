/**
 * Equality-only blind index (docs/decisions/0008-blind-index.md): HMAC-SHA-256 under the
 * KeyRing's blind-index subkey (record 0007, decision 4), via WebCrypto. Nothing here is a
 * primitive of its own.
 *
 * Normalization rules (record 0008, decision 4), applied before hashing:
 *
 * | Field         | Rule                                                                       |
 * | ------------- | -------------------------------------------------------------------------- |
 * | every field   | NFKC, trim, collapse each run of whitespace to one space                   |
 * | `displayName` | then lowercase                                                             |
 * | `email`       | then lowercase the whole address (no dot or `+tag` stripping)              |
 * | `phone`       | then keep a leading `+` and the digits 0-9 only; no digits means empty     |
 *
 * A value that normalizes to empty has no index (`null`). These rules are part of the stored
 * format: changing any of them means bumping `BLIND_INDEX_RULES_VERSION`, which makes the
 * repository rebuild every index on its next open.
 *
 * The field name is part of the HMAC input, so the same value in two different fields does not
 * produce the same index. Never index a prefix, substring or other partial value (AGENTS.md).
 */
import type { KeyRing } from 'keyslot'

import type { BlindIndexedField } from '../domain/sensitiveFields'

/** Bump whenever `normalizeForBlindIndex` changes for any field (record 0008, decision 5). */
export const BLIND_INDEX_RULES_VERSION = 1

const NORMALIZERS: Record<BlindIndexedField, (common: string) => string> = {
  displayName: (value) => value.toLowerCase(),
  email: (value) => value.toLowerCase(),
  phone: (value) => {
    const digits = value.replace(/[^0-9]/gu, '')
    if (digits === '') {
      return ''
    }
    return value.startsWith('+') ? `+${digits}` : digits
  },
}

/** The normalized form a field's blind index is computed over; `''` means "no index". */
export function normalizeForBlindIndex(field: BlindIndexedField, value: string): string {
  const common = value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  return NORMALIZERS[field](common)
}

/** The blind index for `value`, or `null` if it normalizes to empty. */
export async function blindIndex(
  keyRing: KeyRing,
  field: BlindIndexedField,
  value: string,
): Promise<Uint8Array | null> {
  const normalized = normalizeForBlindIndex(field, value)
  if (normalized === '') {
    return null
  }
  // Field names are fixed identifiers with no NUL, so `field \0 value` is unambiguous.
  const input = new TextEncoder().encode(`${field}\u0000${normalized}`)
  return new Uint8Array(await crypto.subtle.sign('HMAC', keyRing.blindIndexKey, input))
}
