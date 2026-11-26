// @vitest-environment node
import { DecryptError, MIN_KDF_PARAMS, UnlockError, UnsupportedFormatError } from 'keyslot'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { decodeExportPayload } from '../domain/exportPayload'
import {
  BUNDLE_SLOT_BYTES,
  BundleFormatError,
  BundleVersionError,
  ExportPassphraseTooShortError,
  openBundle,
  sealBundle,
} from './exportBundle'

const PASSPHRASE = 'export fixture passphrase, not real'
const PAYLOAD = new TextEncoder().encode('{"fixture":"payload bytes, not a real payload"}')
const SLOT_START = 10
const ID_START = SLOT_START + BUNDLE_SLOT_BYTES
const PAYLOAD_START = ID_START + 36

const sealed = await sealBundle(PAYLOAD, PASSPHRASE, MIN_KDF_PARAMS)

function flipped(at: number): Uint8Array {
  const copy = sealed.slice()
  copy[at]! ^= 0x01
  return copy
}

describe('export bundle', () => {
  it('opens what it seals', async () => {
    expect(await openBundle(sealed, PASSPHRASE)).toEqual(PAYLOAD)
  })

  it('writes the version 1 header', () => {
    expect(new TextDecoder().decode(sealed.subarray(0, 7))).toBe('CADREXB')
    expect(sealed[7]).toBe(1)
    expect(new DataView(sealed.buffer).getUint16(8, false)).toBe(87)
    expect(new TextDecoder().decode(sealed.subarray(ID_START, PAYLOAD_START))).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('does not contain the payload in plaintext', () => {
    const hay = Buffer.from(sealed).toString('latin1')
    expect(hay).not.toContain('not a real payload')
  })

  it('gives every bundle a fresh slot, id and ciphertext', async () => {
    const again = await sealBundle(PAYLOAD, PASSPHRASE, MIN_KDF_PARAMS)
    expect(again.subarray(SLOT_START, ID_START)).not.toEqual(sealed.subarray(SLOT_START, ID_START))
    expect(again.subarray(ID_START, PAYLOAD_START)).not.toEqual(
      sealed.subarray(ID_START, PAYLOAD_START),
    )
    expect(again.subarray(PAYLOAD_START)).not.toEqual(sealed.subarray(PAYLOAD_START))
  })

  it('fails a wrong passphrase with UnlockError', async () => {
    await expect(openBundle(sealed, 'a different passphrase entirely')).rejects.toBeInstanceOf(
      UnlockError,
    )
  })

  it('fails a changed slot byte the same way as a wrong passphrase', async () => {
    // Salt, wrap nonce and wrapped key. (Version and settings bytes have their own errors.)
    for (const at of [SLOT_START + 15, SLOT_START + 30, ID_START - 1]) {
      const error = await openBundle(flipped(at), PASSPHRASE).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(UnlockError)
      expect((error as Error).message).toBe(new UnlockError().message)
    }
  })

  it('fails a changed bundle id or payload byte with DecryptError', async () => {
    for (const at of [ID_START, PAYLOAD_START, PAYLOAD_START + 20, sealed.length - 1]) {
      await expect(openBundle(flipped(at), PASSPHRASE)).rejects.toBeInstanceOf(DecryptError)
    }
  })

  it('rejects a newer format version before unlocking, with an update message', async () => {
    const bumped = sealed.slice()
    bumped[7] = 2
    const error = await openBundle(bumped, 'not even checked').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BundleVersionError)
    expect(error).toBeInstanceOf(UnsupportedFormatError)
    expect((error as Error).message).toMatch(/newer version of Cadre/)
  })

  it('rejects bad magic, including the interim CADREi00 bundles', async () => {
    const interim = sealed.slice()
    interim.set(new TextEncoder().encode('CADREi00'), 0)
    for (const bundle of [flipped(0), interim, new Uint8Array(0), new Uint8Array(3)]) {
      await expect(openBundle(bundle, PASSPHRASE)).rejects.toBeInstanceOf(BundleFormatError)
    }
  })

  it('rejects a slot length other than 87', async () => {
    for (const length of [0, 86, 88, 0xffff]) {
      const bundle = sealed.slice()
      new DataView(bundle.buffer).setUint16(8, length, false)
      await expect(openBundle(bundle, PASSPHRASE)).rejects.toThrow(BundleFormatError)
    }
  })

  it('rejects a truncated bundle before unlocking', async () => {
    for (const length of [9, ID_START, PAYLOAD_START, PAYLOAD_START + 60]) {
      await expect(openBundle(sealed.subarray(0, length), PASSPHRASE)).rejects.toBeInstanceOf(
        BundleFormatError,
      )
    }
  })

  it('rejects an export passphrase under 15 characters, counted after NFC', async () => {
    await expect(sealBundle(PAYLOAD, '14 characters!', MIN_KDF_PARAMS)).rejects.toBeInstanceOf(
      ExportPassphraseTooShortError,
    )
    // 15 code points in NFD ("e" + combining acute) but 14 after NFC.
    const nfd = 'cafe\u0301 passphras'
    expect([...nfd].length).toBe(15)
    await expect(sealBundle(PAYLOAD, nfd, MIN_KDF_PARAMS)).rejects.toBeInstanceOf(
      ExportPassphraseTooShortError,
    )
    await expect(sealBundle(PAYLOAD, '15 characters!!', MIN_KDF_PARAMS)).resolves.toBeInstanceOf(
      Uint8Array,
    )
  })

  it('still opens the committed golden version 1 bundle', async () => {
    const golden = Buffer.from(
      readFileSync(new URL('./fixtures/golden-v1.bundle.b64', import.meta.url), 'utf8').trim(),
      'base64',
    )
    const payload = decodeExportPayload(
      await openBundle(new Uint8Array(golden), 'golden fixture passphrase, not real'),
    )
    expect(payload.exportedAt.toISOString()).toBe('2026-11-26T00:00:00.000Z')
    expect(payload.members.map((m) => m.displayName)).toEqual([
      'Golden Fixture One',
      'Golden Fixture Two',
    ])
    expect(payload.members[0]!.email).toBe('golden.one@example.invalid')
    expect(payload.members[1]!.expiresAt?.toISOString()).toBe('2099-01-01T00:00:00.000Z')
  })
})
