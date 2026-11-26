/**
 * Interim export bundle, composed only from the accepted `keyslot` primitives (record 0007): a
 * fresh passphrase slot under the *export* passphrase wraps a new random master key, and the
 * JSON payload is one AES-256-GCM field value under that key's field subkey.
 *
 *   MAGIC (8) ‖ u16 BE slot length ‖ slot ‖ bundle id (36, ASCII UUID) ‖ field value
 *
 * Interim: #14 owns the real bundle format, its version rules, `docs/export-format.md` and the
 * decision record. The magic says "interim" on purpose, so #14's reader can refuse these
 * bundles outright instead of half-parsing them. Do not ship this as the release format.
 */
import { createPassphraseSlot, unlock, type KdfParams } from 'keyslot'

const MAGIC = new TextEncoder().encode('CADREi00')
const NAMESPACE = 'export'
const FIELD = 'payload'
const UUID_LENGTH = 36

export class BundleFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleFormatError'
  }
}

export async function sealBundle(
  payload: Uint8Array,
  passphrase: string,
  kdf?: KdfParams,
): Promise<Uint8Array> {
  const { slot, keyRing } = await createPassphraseSlot(passphrase, kdf ? { kdf } : undefined)
  try {
    const bundleId = crypto.randomUUID()
    const sealed = await keyRing.encryptField(payload, binding(bundleId))
    const out = new Uint8Array(MAGIC.length + 2 + slot.length + UUID_LENGTH + sealed.length)
    let offset = 0
    out.set(MAGIC, offset)
    offset += MAGIC.length
    new DataView(out.buffer).setUint16(offset, slot.length, false)
    offset += 2
    out.set(slot, offset)
    offset += slot.length
    out.set(new TextEncoder().encode(bundleId), offset)
    offset += UUID_LENGTH
    out.set(sealed, offset)
    return out
  } finally {
    keyRing.lock()
  }
}

/** Throws `UnlockError` on a wrong passphrase, `BundleFormatError` on anything unparseable. */
export async function openBundle(bundle: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (!(bundle instanceof Uint8Array) || bundle.length < MAGIC.length + 2) {
    throw new BundleFormatError('Not a Cadre export bundle')
  }
  if (!MAGIC.every((byte, i) => bundle[i] === byte)) {
    throw new BundleFormatError('Not a Cadre interim export bundle')
  }
  let offset = MAGIC.length
  const slotLength = new DataView(bundle.buffer, bundle.byteOffset).getUint16(offset, false)
  offset += 2
  if (bundle.length < offset + slotLength + UUID_LENGTH + 1) {
    throw new BundleFormatError('Truncated export bundle')
  }
  const slot = bundle.subarray(offset, offset + slotLength)
  offset += slotLength
  const bundleId = new TextDecoder().decode(bundle.subarray(offset, offset + UUID_LENGTH))
  offset += UUID_LENGTH
  const keyRing = await unlock(passphrase, slot)
  try {
    return await keyRing.decryptField(bundle.subarray(offset), binding(bundleId))
  } finally {
    keyRing.lock()
  }
}

function binding(bundleId: string) {
  return { namespace: NAMESPACE, recordId: bundleId, field: FIELD }
}
