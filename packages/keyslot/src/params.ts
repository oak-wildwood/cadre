/**
 * Argon2id settings. Literal numbers on purpose: a test asserts they equal libsodium's
 * `crypto_pwhash_*` constants, so neither side can drift silently.
 */

export interface KdfParams {
  /** libsodium algorithm id. `2` = `crypto_pwhash_ALG_ARGON2ID13`, the only one accepted. */
  algorithm: number
  /** Passes over memory. */
  opslimit: number
  /** Memory in bytes. */
  memlimit: number
}

export const ARGON2ID13 = 2

/** libsodium "moderate": 3 passes over 256 MiB. Used for new slots. */
export const DEFAULT_KDF_PARAMS: Readonly<KdfParams> = Object.freeze({
  algorithm: ARGON2ID13,
  opslimit: 3,
  memlimit: 268435456,
})

/** libsodium "interactive": the floor a stored slot may ask for. */
export const MIN_KDF_PARAMS: Readonly<KdfParams> = Object.freeze({
  algorithm: ARGON2ID13,
  opslimit: 2,
  memlimit: 67108864,
})

/** libsodium "sensitive": the ceiling, so a tampered slot can't freeze or crash the device. */
export const MAX_KDF_PARAMS: Readonly<KdfParams> = Object.freeze({
  algorithm: ARGON2ID13,
  opslimit: 4,
  memlimit: 1073741824,
})

export function kdfParamsInRange(params: KdfParams): boolean {
  return (
    params.algorithm === ARGON2ID13 &&
    Number.isSafeInteger(params.opslimit) &&
    Number.isSafeInteger(params.memlimit) &&
    params.opslimit >= MIN_KDF_PARAMS.opslimit &&
    params.opslimit <= MAX_KDF_PARAMS.opslimit &&
    params.memlimit >= MIN_KDF_PARAMS.memlimit &&
    params.memlimit <= MAX_KDF_PARAMS.memlimit
  )
}
