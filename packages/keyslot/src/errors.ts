/**
 * Error classes. Messages are fixed strings: no error ever carries the passphrase, plaintext,
 * key material or a `cause` that could tell a wrong passphrase apart from a damaged store.
 */

/** Wrong passphrase, damaged slot or tampered slot. Deliberately indistinguishable. */
export class UnlockError extends Error {
  constructor() {
    super('Could not unlock: the passphrase is wrong or the key slot is damaged.')
    this.name = 'UnlockError'
  }
}

/** A field value failed authentication, was truncated, or is otherwise unreadable. */
export class DecryptError extends Error {
  constructor() {
    super('Could not decrypt the value.')
    this.name = 'DecryptError'
  }
}

/** The `KeyRing` was used after `lock()`. */
export class LockedError extends Error {
  constructor() {
    super('The key ring is locked.')
    this.name = 'LockedError'
  }
}

/**
 * libsodium or WebCrypto is missing, or the device could not run Argon2id at the requested
 * settings. Never a statement about the passphrase.
 */
export class CryptoUnavailableError extends Error {
  constructor() {
    super('This device cannot run the encryption: libsodium or WebCrypto is unavailable.')
    this.name = 'CryptoUnavailableError'
  }
}

/** A slot or value was written by a newer format version or slot kind than this build knows. */
export class UnsupportedFormatError extends Error {
  constructor() {
    super('This data was written by a newer version. Update to read it.')
    this.name = 'UnsupportedFormatError'
  }
}
