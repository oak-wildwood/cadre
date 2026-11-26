/**
 * keyslot: passphrase key slots and per-field AES-256-GCM encryption. Composes libsodium
 * (Argon2id, crypto_kdf, padding, memzero) and WebCrypto (AES-GCM, HMAC); implements no
 * primitive itself. See README.md.
 */
export { ready } from './sodium'
export {
  createPassphraseSlot,
  unlock,
  rewrapPassphraseSlot,
  readSlotParams,
  type SlotOptions,
} from './slot'
export { DEFAULT_KDF_PARAMS, MIN_KDF_PARAMS, MAX_KDF_PARAMS, type KdfParams } from './params'
export type { KeyRing } from './keyring'
export type { FieldBinding } from './field'
export {
  UnlockError,
  DecryptError,
  LockedError,
  CryptoUnavailableError,
  UnsupportedFormatError,
} from './errors'
