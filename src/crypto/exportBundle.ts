/**
 * Export bundle framing, format version 1 (record 0010, decision 4; byte layout in
 * `docs/export-format.md`). Composes only the accepted `keyslot` primitives (record 0007): a
 * fresh passphrase slot under the *export* passphrase wraps a new random key, and the payload
 * is one AES-256-GCM field value under that key's field subkey.
 *
 *   "CADREXB" (7) ‖ version (1) ‖ u16 BE slot length (87) ‖ slot ‖ bundle id (36) ‖ field value
 *
 * This module only frames and seals bytes. The JSON payload lives in `domain/exportPayload.ts`.
 */
import { createPassphraseSlot, unlock, UnsupportedFormatError, type KdfParams } from 'keyslot'

export const BUNDLE_MAGIC = 'CADREXB'
export const BUNDLE_VERSION = 1
/** Length of a version-1 keyslot passphrase slot (record 0007, decision 6). */
export const BUNDLE_SLOT_BYTES = 87
/** Smallest keyslot field value: version + nonce + one 32-byte padded block + tag. */
const MIN_FIELD_VALUE_BYTES = 61
const BUNDLE_ID_BYTES = 36
const MAGIC_BYTES = new TextEncoder().encode(BUNDLE_MAGIC)
const HEADER_BYTES = MAGIC_BYTES.length + 1 + 2

/** Export passphrases must be at least this many characters (record 0010, decision 3). */
export const MIN_EXPORT_PASSPHRASE_LENGTH = 15

/** Not a Cadre export bundle, or a damaged one, detected before any decryption. */
export class BundleFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleFormatError'
  }
}

/** A bundle written by a newer Cadre. Distinct from a wrong passphrase on purpose. */
export class BundleVersionError extends UnsupportedFormatError {
  constructor() {
    super()
    this.message =
      'This export bundle was made by a newer version of Cadre. Update Cadre to import it.'
    this.name = 'BundleVersionError'
  }
}

export class ExportPassphraseTooShortError extends Error {
  constructor() {
    super(`Export passphrases must be at least ${MIN_EXPORT_PASSPHRASE_LENGTH} characters.`)
    this.name = 'ExportPassphraseTooShortError'
  }
}

/** Counts Unicode code points after NFC, matching how keyslot normalizes the passphrase. */
export function checkExportPassphrase(passphrase: string): void {
  if (typeof passphrase !== 'string') {
    throw new TypeError('passphrase must be a string')
  }
  if ([...passphrase.normalize('NFC')].length < MIN_EXPORT_PASSPHRASE_LENGTH) {
    throw new ExportPassphraseTooShortError()
  }
}

/** Seals `payload` under a fresh key slot for `passphrase`. Checks the passphrase minimum. */
export async function sealBundle(
  payload: Uint8Array,
  passphrase: string,
  kdf?: KdfParams,
): Promise<Uint8Array> {
  checkExportPassphrase(passphrase)
  const { slot, keyRing } = await createPassphraseSlot(passphrase, kdf ? { kdf } : undefined)
  try {
    if (slot.length !== BUNDLE_SLOT_BYTES) {
      // keyslot changed its slot format; version 1 bundles pin the length.
      throw new Error('Unexpected key slot length')
    }
    const bundleId = crypto.randomUUID()
    const sealed = await keyRing.encryptField(payload, binding(BUNDLE_VERSION, bundleId))
    const out = new Uint8Array(HEADER_BYTES + slot.length + BUNDLE_ID_BYTES + sealed.length)
    out.set(MAGIC_BYTES, 0)
    out[MAGIC_BYTES.length] = BUNDLE_VERSION
    new DataView(out.buffer).setUint16(MAGIC_BYTES.length + 1, slot.length, false)
    let offset = HEADER_BYTES
    out.set(slot, offset)
    offset += slot.length
    out.set(new TextEncoder().encode(bundleId), offset)
    offset += BUNDLE_ID_BYTES
    out.set(sealed, offset)
    return out
  } finally {
    keyRing.lock()
  }
}

/**
 * Opens a bundle, checking in the order `docs/export-format.md` gives. Throws
 * `BundleFormatError` for anything structurally wrong, `BundleVersionError` for a newer
 * version, keyslot's `UnlockError` for a wrong passphrase or damaged slot, and keyslot's
 * `DecryptError` for a damaged bundle id or payload.
 */
export async function openBundle(bundle: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (!(bundle instanceof Uint8Array) || bundle.length < MAGIC_BYTES.length) {
    throw new BundleFormatError('Not a Cadre export bundle')
  }
  if (!MAGIC_BYTES.every((byte, i) => bundle[i] === byte)) {
    throw new BundleFormatError('Not a Cadre export bundle')
  }
  if (bundle.length < HEADER_BYTES) {
    throw new BundleFormatError('Truncated export bundle')
  }
  const version = bundle[MAGIC_BYTES.length]!
  if (version !== BUNDLE_VERSION) {
    throw new BundleVersionError()
  }
  const slotLength = new DataView(bundle.buffer, bundle.byteOffset).getUint16(
    MAGIC_BYTES.length + 1,
    false,
  )
  if (slotLength !== BUNDLE_SLOT_BYTES) {
    throw new BundleFormatError('Damaged export bundle header')
  }
  if (bundle.length < HEADER_BYTES + slotLength + BUNDLE_ID_BYTES + MIN_FIELD_VALUE_BYTES) {
    throw new BundleFormatError('Truncated export bundle')
  }
  let offset = HEADER_BYTES
  const slot = bundle.subarray(offset, offset + slotLength)
  offset += slotLength
  const bundleId = new TextDecoder().decode(bundle.subarray(offset, offset + BUNDLE_ID_BYTES))
  offset += BUNDLE_ID_BYTES
  const keyRing = await unlock(passphrase, slot)
  try {
    // The id is bound into the AAD, so a changed id fails decryption like a changed payload.
    return await keyRing.decryptField(bundle.subarray(offset), binding(version, bundleId))
  } finally {
    keyRing.lock()
  }
}

function binding(version: number, bundleId: string) {
  return { namespace: `cadre-export-v${version}`, recordId: bundleId, field: 'payload' }
}
