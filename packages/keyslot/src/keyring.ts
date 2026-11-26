import { buf } from './bytes'
import { LockedError } from './errors'
import { decryptFieldValue, encryptFieldValue, type FieldBinding } from './field'
import { sodium } from './sodium'

/**
 * The unlocked keys, held in memory only as non-extractable WebCrypto keys (record 0007,
 * decision 7). The master key is not kept; rotating or re-wrapping asks for the passphrase.
 */
export interface KeyRing {
  encryptField(plaintext: Uint8Array, binding: FieldBinding): Promise<Uint8Array>
  decryptField(value: Uint8Array, binding: FieldBinding): Promise<Uint8Array>
  /** HMAC-SHA-256 key, `sign` only, for equality blind indexes. Throws `LockedError` once locked. */
  readonly blindIndexKey: CryptoKey
  /** Drops both keys. Every later call throws `LockedError`. Idempotent. */
  lock(): void
  readonly locked: boolean
}

/** Subkey ids and contexts. Never reuse or renumber; add new ones for new purposes. */
export const SUBKEYS = Object.freeze({
  field: { id: 1, context: 'fieldenc' },
  blindIndex: { id: 2, context: 'blindidx' },
})

const SUBKEY_BYTES = 32

interface Keys {
  fieldKey: CryptoKey
  blindIndexKey: CryptoKey
}

/**
 * Test-only window onto a ring's keys, so tests can assert they are non-extractable. Not
 * exported from the package entry point.
 */
export const keyRingInternals = new WeakMap<KeyRing, Keys>()

/** Raw subkey bytes. Internal: callers must `memzero` both. */
export function deriveSubkeyBytes(masterKey: Uint8Array): {
  field: Uint8Array
  blindIndex: Uint8Array
} {
  return {
    field: sodium.crypto_kdf_derive_from_key(
      SUBKEY_BYTES,
      SUBKEYS.field.id,
      SUBKEYS.field.context,
      masterKey,
    ),
    blindIndex: sodium.crypto_kdf_derive_from_key(
      SUBKEY_BYTES,
      SUBKEYS.blindIndex.id,
      SUBKEYS.blindIndex.context,
      masterKey,
    ),
  }
}

/** Derives both subkeys, imports them non-extractable, and wipes the raw bytes. */
export async function keyRingFromMasterKey(masterKey: Uint8Array): Promise<KeyRing> {
  const raw = deriveSubkeyBytes(masterKey)
  try {
    const fieldKey = await crypto.subtle.importKey(
      'raw',
      buf(raw.field),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    const blindIndexKey = await crypto.subtle.importKey(
      'raw',
      buf(raw.blindIndex),
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    )
    return new UnlockedKeyRing({ fieldKey, blindIndexKey })
  } finally {
    sodium.memzero(raw.field)
    sodium.memzero(raw.blindIndex)
  }
}

class UnlockedKeyRing implements KeyRing {
  #keys: Keys | null

  constructor(keys: Keys) {
    this.#keys = keys
    keyRingInternals.set(this, keys)
  }

  get locked(): boolean {
    return this.#keys === null
  }

  get blindIndexKey(): CryptoKey {
    return this.#require().blindIndexKey
  }

  encryptField(plaintext: Uint8Array, binding: FieldBinding): Promise<Uint8Array> {
    const { fieldKey } = this.#require()
    return encryptFieldValue(fieldKey, plaintext, binding)
  }

  decryptField(value: Uint8Array, binding: FieldBinding): Promise<Uint8Array> {
    const { fieldKey } = this.#require()
    return decryptFieldValue(fieldKey, value, binding)
  }

  lock(): void {
    this.#keys = null
    keyRingInternals.delete(this)
  }

  #require(): Keys {
    if (this.#keys === null) {
      throw new LockedError()
    }
    return this.#keys
  }
}
