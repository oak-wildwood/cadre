/**
 * Passphrase key slot (record 0007, decisions 4, 6 and 8). 87 bytes:
 *
 *   off len
 *     0   1  slot format version (0x01)
 *     1   1  slot kind (0x01 = passphrase)
 *     2   1  KDF algorithm (0x02 = Argon2id13)
 *     3   4  opslimit, u32 BE
 *     7   4  memlimit bytes, u32 BE
 *    11  16  salt
 *    27  12  wrap nonce
 *    39  48  AES-256-GCM(master key) incl. tag
 *
 * Bytes 0..26 are the AAD of the wrap. The wrap's tag is the passphrase check: no hash of the
 * passphrase is stored anywhere.
 */
import { buf } from './bytes'
import { CryptoUnavailableError, UnlockError, UnsupportedFormatError } from './errors'
import { keyRingFromMasterKey, type KeyRing } from './keyring'
import { DEFAULT_KDF_PARAMS, kdfParamsInRange, type KdfParams } from './params'
import { ready, sodium } from './sodium'

export const SLOT_FORMAT_V1 = 0x01
export const SLOT_KIND_PASSPHRASE = 0x01
export const PASSPHRASE_SLOT_BYTES = 87

const SALT_BYTES = 16
const NONCE_BYTES = 12
const MASTER_KEY_BYTES = 32
const WRAPPING_KEY_BYTES = 32
const HEADER_BYTES = 27 // version, kind, alg, ops, mem, salt
const WRAPPED_OFFSET = HEADER_BYTES + NONCE_BYTES

export interface SlotOptions {
  /** Argon2id settings for the new slot. Defaults to `DEFAULT_KDF_PARAMS`. */
  kdf?: KdfParams
}

interface ParsedSlot {
  params: KdfParams
  header: Uint8Array
  salt: Uint8Array
  nonce: Uint8Array
  wrapped: Uint8Array
}

/** New random master key, wrapped under `passphrase`. */
export async function createPassphraseSlot(
  passphrase: string,
  options?: SlotOptions,
): Promise<{ slot: Uint8Array; keyRing: KeyRing }> {
  await ready()
  const params = checkedOptionParams(options)
  const masterKey = sodium.crypto_kdf_keygen()
  try {
    const slot = await wrapMasterKey(passphrase, masterKey, params)
    const keyRing = await keyRingFromMasterKey(masterKey)
    return { slot, keyRing }
  } finally {
    sodium.memzero(masterKey)
  }
}

/** Unwraps the slot's master key and returns a `KeyRing`. Throws `UnlockError` on any failure. */
export async function unlock(passphrase: string, slot: Uint8Array): Promise<KeyRing> {
  await ready()
  const masterKey = await unwrapMasterKey(passphrase, slot)
  try {
    return await keyRingFromMasterKey(masterKey)
  } finally {
    sodium.memzero(masterKey)
  }
}

/**
 * Same master key, new slot under `newPassphrase` (which may equal `passphrase`, to raise the
 * Argon2id settings). Existing field values stay readable. Note this does not lock out anyone
 * holding a copy of the old slot and passphrase; that needs a rotation (record 0007, decision 4).
 */
export async function rewrapPassphraseSlot(
  passphrase: string,
  slot: Uint8Array,
  newPassphrase: string,
  options?: SlotOptions,
): Promise<Uint8Array> {
  await ready()
  const params = checkedOptionParams(options)
  const masterKey = await unwrapMasterKey(passphrase, slot)
  try {
    return await wrapMasterKey(newPassphrase, masterKey, params)
  } finally {
    sodium.memzero(masterKey)
  }
}

/** The Argon2id settings stored in a slot, e.g. to see whether it is below current defaults. */
export function readSlotParams(slot: Uint8Array): KdfParams {
  return { ...parseSlot(slot).params }
}

function checkedOptionParams(options: SlotOptions | undefined): KdfParams {
  const params = { ...(options?.kdf ?? DEFAULT_KDF_PARAMS) }
  if (!kdfParamsInRange(params)) {
    throw new RangeError('KDF settings are outside the allowed range')
  }
  return params
}

function parseSlot(slot: Uint8Array): ParsedSlot {
  if (!(slot instanceof Uint8Array) || slot.length < 2) {
    throw new UnlockError()
  }
  const version = slot[0]!
  const kind = slot[1]!
  if (version > SLOT_FORMAT_V1 || kind > SLOT_KIND_PASSPHRASE) {
    throw new UnsupportedFormatError()
  }
  if (
    version !== SLOT_FORMAT_V1 ||
    kind !== SLOT_KIND_PASSPHRASE ||
    slot.length !== PASSPHRASE_SLOT_BYTES
  ) {
    throw new UnlockError()
  }
  const view = new DataView(slot.buffer, slot.byteOffset, slot.byteLength)
  const params: KdfParams = {
    algorithm: slot[2]!,
    opslimit: view.getUint32(3, false),
    memlimit: view.getUint32(7, false),
  }
  // A tampered or broken slot: rejected before Argon2id ever runs.
  if (!kdfParamsInRange(params)) {
    throw new UnlockError()
  }
  return {
    params,
    header: slot.slice(0, HEADER_BYTES),
    salt: slot.slice(11, 11 + SALT_BYTES),
    nonce: slot.slice(HEADER_BYTES, WRAPPED_OFFSET),
    wrapped: slot.slice(WRAPPED_OFFSET),
  }
}

async function wrapMasterKey(
  passphrase: string,
  masterKey: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))

  const slot = new Uint8Array(PASSPHRASE_SLOT_BYTES)
  const view = new DataView(slot.buffer)
  slot[0] = SLOT_FORMAT_V1
  slot[1] = SLOT_KIND_PASSPHRASE
  slot[2] = params.algorithm
  view.setUint32(3, params.opslimit, false)
  view.setUint32(7, params.memlimit, false)
  slot.set(salt, 11)
  slot.set(nonce, HEADER_BYTES)

  const wrappingKey = await wrappingKeyFor(passphrase, salt, params, ['encrypt'])
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: slot.subarray(0, HEADER_BYTES),
        tagLength: 128,
      },
      wrappingKey,
      buf(masterKey),
    ),
  )
  slot.set(wrapped, WRAPPED_OFFSET)
  return slot
}

async function unwrapMasterKey(passphrase: string, slot: Uint8Array): Promise<Uint8Array> {
  const parsed = parseSlot(slot)
  const wrappingKey = await wrappingKeyFor(passphrase, parsed.salt, parsed.params, ['decrypt'])
  let masterKey: Uint8Array
  try {
    masterKey = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: buf(parsed.nonce),
          additionalData: buf(parsed.header),
          tagLength: 128,
        },
        wrappingKey,
        buf(parsed.wrapped),
      ),
    )
  } catch {
    throw new UnlockError()
  }
  if (masterKey.length !== MASTER_KEY_BYTES) {
    sodium.memzero(masterKey)
    throw new UnlockError()
  }
  return masterKey
}

/** Argon2id over the NFC-normalized passphrase, imported as a non-extractable AES-GCM key. */
async function wrappingKeyFor(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  if (typeof passphrase !== 'string') {
    throw new TypeError('passphrase must be a string')
  }
  const passphraseBytes = new TextEncoder().encode(passphrase.normalize('NFC'))
  let raw: Uint8Array
  try {
    raw = sodium.crypto_pwhash(
      WRAPPING_KEY_BYTES,
      passphraseBytes,
      salt,
      params.opslimit,
      params.memlimit,
      params.algorithm,
    )
  } catch {
    // Argon2id doesn't fail on a wrong passphrase, only when it can't run (e.g. out of memory).
    throw new CryptoUnavailableError()
  } finally {
    sodium.memzero(passphraseBytes)
  }
  try {
    return await crypto.subtle.importKey('raw', buf(raw), { name: 'AES-GCM' }, false, usages)
  } finally {
    sodium.memzero(raw)
  }
}
