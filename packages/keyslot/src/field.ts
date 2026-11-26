/**
 * Field value format (record 0007, decisions 5 and 6):
 *
 *   version (1) ‖ nonce (12) ‖ AES-256-GCM(pad32(plaintext), aad) incl. 16-byte tag
 *
 *   aad = version ‖ u16 len ‖ namespace ‖ u16 len ‖ recordId ‖ u16 len ‖ field   (UTF-8, BE)
 */
import { buf } from './bytes'
import { DecryptError, UnsupportedFormatError } from './errors'
import { sodium } from './sodium'

export interface FieldBinding {
  /** e.g. the table name. */
  namespace: string
  /** e.g. the row's UUID. */
  recordId: string
  /** e.g. the column's logical field name. */
  field: string
}

export const FIELD_FORMAT_V1 = 0x01
const NONCE_BYTES = 12
const TAG_BYTES = 16
const PAD_BLOCK = 32
const HEADER_BYTES = 1 + NONCE_BYTES
/** version + nonce + one padded block + tag. */
export const MIN_FIELD_VALUE_BYTES = HEADER_BYTES + PAD_BLOCK + TAG_BYTES

const encoder = new TextEncoder()

export function encodeFieldAad(version: number, binding: FieldBinding): Uint8Array {
  const parts = [binding.namespace, binding.recordId, binding.field].map((part, i) => {
    if (typeof part !== 'string' || part.length === 0) {
      throw new TypeError(`FieldBinding.${['namespace', 'recordId', 'field'][i]} must be non-empty`)
    }
    const bytes = encoder.encode(part)
    if (bytes.length > 0xffff) {
      throw new TypeError('FieldBinding parts must be at most 65535 UTF-8 bytes')
    }
    return bytes
  })
  const aad = new Uint8Array(1 + parts.reduce((n, p) => n + 2 + p.length, 0))
  const view = new DataView(aad.buffer)
  aad[0] = version
  let offset = 1
  for (const part of parts) {
    view.setUint16(offset, part.length, false)
    aad.set(part, offset + 2)
    offset += 2 + part.length
  }
  return aad
}

export async function encryptFieldValue(
  key: CryptoKey,
  plaintext: Uint8Array,
  binding: FieldBinding,
): Promise<Uint8Array> {
  const aad = encodeFieldAad(FIELD_FORMAT_V1, binding)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const padded = sodium.pad(plaintext, PAD_BLOCK)
  try {
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: buf(aad), tagLength: TAG_BYTES * 8 },
        key,
        buf(padded),
      ),
    )
    const out = new Uint8Array(HEADER_BYTES + sealed.length)
    out[0] = FIELD_FORMAT_V1
    out.set(nonce, 1)
    out.set(sealed, HEADER_BYTES)
    return out
  } finally {
    sodium.memzero(padded)
  }
}

export async function decryptFieldValue(
  key: CryptoKey,
  value: Uint8Array,
  binding: FieldBinding,
): Promise<Uint8Array> {
  if (!(value instanceof Uint8Array) || value.length < 1) {
    throw new DecryptError()
  }
  const version = value[0]!
  if (version > FIELD_FORMAT_V1) {
    throw new UnsupportedFormatError()
  }
  if (
    version !== FIELD_FORMAT_V1 ||
    value.length < MIN_FIELD_VALUE_BYTES ||
    (value.length - HEADER_BYTES - TAG_BYTES) % PAD_BLOCK !== 0
  ) {
    throw new DecryptError()
  }
  const aad = encodeFieldAad(version, binding)
  let padded: Uint8Array
  try {
    padded = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: buf(value.subarray(1, HEADER_BYTES)),
          additionalData: buf(aad),
          tagLength: TAG_BYTES * 8,
        },
        key,
        buf(value.subarray(HEADER_BYTES)),
      ),
    )
  } catch {
    throw new DecryptError()
  }
  try {
    return sodium.unpad(padded, PAD_BLOCK).slice()
  } catch {
    throw new DecryptError()
  } finally {
    sodium.memzero(padded)
  }
}
