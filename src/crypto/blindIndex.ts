/**
 * Equality-only blind index: HMAC-SHA-256 under the KeyRing's blind-index subkey (record 0007,
 * decision 3), via WebCrypto. Nothing here is a primitive of its own.
 *
 * Interim: #12 owns the normalization rules (including field-specific ones for email and phone)
 * and the decision record for them. This version does only what the repository contract needs.
 * Changing `normalize` means recomputing every stored `*_bidx`, which is cheap while no
 * release has written member data.
 *
 * The field name is part of the HMAC input, so the same value in two different fields does not
 * produce the same index. Never index a prefix, substring or other partial value (AGENTS.md).
 */
import type { KeyRing } from 'keyslot'

import type { BlindIndexedField } from '../domain/sensitiveFields'

/** NFKC, trim, collapse internal whitespace, lowercase. */
export function normalizeForBlindIndex(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

export async function blindIndex(
  keyRing: KeyRing,
  field: BlindIndexedField,
  value: string,
): Promise<Uint8Array> {
  // Field names are fixed identifiers with no NUL, so `field \0 value` is unambiguous.
  const input = new TextEncoder().encode(`${field}\u0000${normalizeForBlindIndex(value)}`)
  return new Uint8Array(await crypto.subtle.sign('HMAC', keyRing.blindIndexKey, input))
}
