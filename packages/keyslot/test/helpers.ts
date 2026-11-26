import { createPassphraseSlot, MIN_KDF_PARAMS, type FieldBinding } from '../src/index'

/** Interactive settings keep the suite fast; the defaults themselves are tested in params.spec. */
export const FAST = { kdf: MIN_KDF_PARAMS }

export const PASSPHRASE = 'correct horse battery staple'

export const BINDING: FieldBinding = {
  namespace: 'members',
  recordId: '00000000-0000-4000-8000-000000000001',
  field: 'displayName',
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
export const text = (b: Uint8Array): string => new TextDecoder().decode(b)
export const fromHex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, 'hex'))
export const toHex = (b: Uint8Array | ArrayBuffer): string =>
  Buffer.from(b instanceof ArrayBuffer ? new Uint8Array(b) : b).toString('hex')

export function flip(bytes: Uint8Array, index: number): Uint8Array {
  const copy = bytes.slice()
  copy[index] = copy[index]! ^ 0x01
  return copy
}

export async function newRing() {
  return (await createPassphraseSlot(PASSPHRASE, FAST)).keyRing
}

/** Captures the error a promise rejects with, failing if it resolves. */
export async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }
  throw new Error('expected a rejection')
}
