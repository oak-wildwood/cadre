// @vitest-environment node
// Record 0007, decision 12: tests 4, 10, 11, 12, 13, 14, 18, 19, 20, 21 and the unlock half of 22.
import { describe, expect, it } from 'vitest'

import {
  createPassphraseSlot,
  LockedError,
  MIN_KDF_PARAMS,
  readSlotParams,
  rewrapPassphraseSlot,
  unlock,
  UnlockError,
  UnsupportedFormatError,
} from '../src/index'
import { deriveSubkeyBytes, keyRingInternals, SUBKEYS } from '../src/keyring'
import { sodium } from '../src/sodium'
import { BINDING, FAST, flip, fromHex, PASSPHRASE, rejection, text, toHex, utf8 } from './helpers'

/**
 * Golden vectors, made once with this build (libsodium 1.0.22) and the test passphrase at
 * MIN_KDF_PARAMS. If these stop unlocking or decrypting, the slot or field format changed:
 * that needs a new format version, not new vectors.
 */
const GOLDEN = {
  passphrase: PASSPHRASE,
  slot: fromHex(
    '0101020000000204000000788b4465c0d992af5f9cf31f895486042e42762f1c277e31aa5f89f890942590de' +
      'f57b9fae61bc219c47896e889f7310ca1a5690d5c3b9db56e585bdcfe9194434e7042a22c03bd1deab1d6b',
  ),
  value: fromHex(
    '0171ff602ad02df525f38da6099808a3de88e708d23a8a23fdc5da8e9eeebb9b573af152d4246e50a0873f' +
      '294b90eb16d29ec095a11c4d1c4cf043511e',
  ),
  plaintext: 'Ada Lovelace',
}

const SLOT_REGIONS = {
  version: 0,
  kind: 1,
  algorithm: 2,
  opslimit: 3,
  memlimit: 7,
  salt: 11,
  nonce: 27,
  wrappedKey: 39,
  tag: 86,
}

async function hmac(key: CryptoKey, data: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, utf8(data).slice()))
}

describe('passphrase slots', () => {
  it('creates an 87-byte slot that unlocks with the passphrase', async () => {
    const { slot, keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    expect(slot.length).toBe(87)
    const sealed = await keyRing.encryptField(utf8('Ada'), BINDING)

    const reopened = await unlock(PASSPHRASE, slot)
    expect(text(await reopened.decryptField(sealed, BINDING))).toBe('Ada')
  })

  // Test 4
  it('refuses a wrong passphrase', async () => {
    const { slot } = await createPassphraseSlot(PASSPHRASE, FAST)
    await expect(unlock('correct horse battery stapler', slot)).rejects.toBeInstanceOf(UnlockError)
  })

  // Test 11
  it('still unlocks the committed golden slot and decrypts its golden value', async () => {
    const ring = await unlock(GOLDEN.passphrase, GOLDEN.slot)
    expect(text(await ring.decryptField(GOLDEN.value, BINDING))).toBe(GOLDEN.plaintext)
    expect(readSlotParams(GOLDEN.slot)).toEqual(MIN_KDF_PARAMS)
  })

  // Test 14
  it('fails the same way for a wrong passphrase, any flipped region, and truncation', async () => {
    const { slot } = await createPassphraseSlot(PASSPHRASE, FAST)
    const failures: Error[] = [await rejection(unlock('not the passphrase at all', slot))]
    for (const index of Object.values(SLOT_REGIONS)) {
      failures.push(await rejection(unlock(PASSPHRASE, flip(slot, index))))
    }
    for (const length of [0, 1, 2, 27, 86]) {
      failures.push(await rejection(unlock(PASSPHRASE, slot.slice(0, length))))
    }
    failures.push(await rejection(unlock(PASSPHRASE, Uint8Array.from([...slot, 0]))))

    const reference = new UnlockError()
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(UnlockError)
      expect(failure.constructor).toBe(UnlockError)
      expect(failure.message).toBe(reference.message)
      expect(failure.cause).toBeUndefined()
    }
  })

  it('reports a newer slot version or kind as unsupported, not as a wrong passphrase', async () => {
    const { slot } = await createPassphraseSlot(PASSPHRASE, FAST)
    for (const index of [0, 1]) {
      const newer = slot.slice()
      newer[index] = 0x02
      await expect(unlock(PASSPHRASE, newer)).rejects.toBeInstanceOf(UnsupportedFormatError)
    }
  })

  // Test 18
  it('treats NFC and NFD spellings of a passphrase as the same', async () => {
    const nfc = 'café crème brûlée'.normalize('NFC')
    const nfd = nfc.normalize('NFD')
    expect(nfd).not.toBe(nfc)

    const { slot } = await createPassphraseSlot(nfd, FAST)
    await expect(unlock(nfc, slot)).resolves.toBeDefined()
    // Nothing beyond NFC: no trimming or case folding.
    await expect(unlock(`${nfc} `, slot)).rejects.toBeInstanceOf(UnlockError)
    await expect(unlock(nfc.toUpperCase(), slot)).rejects.toBeInstanceOf(UnlockError)
  })

  // Test 19
  it('re-wraps: old passphrase fails, new one works, old values still decrypt', async () => {
    const { slot, keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const sealed = await keyRing.encryptField(utf8('Grace Hopper'), BINDING)

    const rewrapped = await rewrapPassphraseSlot(PASSPHRASE, slot, 'a brand new passphrase', FAST)

    await expect(unlock(PASSPHRASE, rewrapped)).rejects.toBeInstanceOf(UnlockError)
    const ring = await unlock('a brand new passphrase', rewrapped)
    expect(text(await ring.decryptField(sealed, BINDING))).toBe('Grace Hopper')
    expect(await hmac(ring.blindIndexKey, 'x')).toBe(await hmac(keyRing.blindIndexKey, 'x'))
  })

  // Test 20, at the key level. Rotation is a fresh master key; walking the rows to re-encrypt
  // them belongs to the repository (#10) and the blind-index normalization to #12.
  it('rotates: new values are unreadable with the old slot, and blind indexes change', async () => {
    const old = await createPassphraseSlot(PASSPHRASE, FAST)
    const rotated = await createPassphraseSlot(PASSPHRASE, FAST)

    const written = await rotated.keyRing.encryptField(utf8('Ada'), BINDING)
    const oldRing = await unlock(PASSPHRASE, old.slot)
    await expect(oldRing.decryptField(written, BINDING)).rejects.toThrow()

    for (const value of ['ada lovelace', 'ada@example.org', '+15555550100']) {
      expect(await hmac(rotated.keyRing.blindIndexKey, value)).not.toBe(
        await hmac(oldRing.blindIndexKey, value),
      )
    }
  })

  // Test 21
  it('gives two new slots different salts, nonces and master keys', async () => {
    const a = await createPassphraseSlot(PASSPHRASE, FAST)
    const b = await createPassphraseSlot(PASSPHRASE, FAST)
    expect(a.slot.subarray(11, 27)).not.toEqual(b.slot.subarray(11, 27))
    expect(a.slot.subarray(27, 39)).not.toEqual(b.slot.subarray(27, 39))
    const sealed = await a.keyRing.encryptField(utf8('Ada'), BINDING)
    await expect(b.keyRing.decryptField(sealed, BINDING)).rejects.toThrow()
  })

  // Test 22, unlock half
  it('never puts the passphrase in an unlock error', async () => {
    const passphrase = 'my very secret passphrase 1234'
    const { slot } = await createPassphraseSlot(passphrase, FAST)
    const error = await rejection(unlock(`${passphrase}!`, slot))
    for (const surface of [
      error.message,
      String(error),
      error.stack ?? '',
      JSON.stringify(error),
    ]) {
      expect(surface).not.toContain('secret')
      expect(surface).not.toContain('1234')
    }
  })
})

describe('KeyRing', () => {
  // Test 10
  it('derives two different subkeys that match the known-answer vector', async () => {
    await sodium.ready
    const master = Uint8Array.from({ length: 32 }, (_, i) => i)
    const { field, blindIndex } = deriveSubkeyBytes(master)

    expect(toHex(field)).toBe('68fd4456b24b616c2b71814853fe52dba66074f8060d6fea7fb6314c3c7fee67')
    expect(toHex(blindIndex)).toBe(
      '24a9a477d58891793ef8924c7a19165534839a820ef55e1d9c1fcc0a5f47906f',
    )
    expect(toHex(field)).not.toBe(toHex(blindIndex))

    // Cross-check against crypto_kdf's documented construction: BLAKE2b keyed with the master
    // key, the subkey id as a little-endian salt and the context as personalization.
    for (const [subkey, { id, context }] of [
      [field, SUBKEYS.field],
      [blindIndex, SUBKEYS.blindIndex],
    ] as const) {
      const salt = new Uint8Array(16)
      salt[0] = id
      const personal = new Uint8Array(16)
      personal.set(utf8(context))
      const expected = sodium.crypto_generichash_blake2b_salt_personal(32, master, salt, personal)
      expect(toHex(subkey)).toBe(toHex(expected))
    }
  })

  // Test 12
  it('holds only non-extractable keys with the narrowest usages', async () => {
    const { keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const keys = keyRingInternals.get(keyRing)!
    expect(keys.blindIndexKey).toBe(keyRing.blindIndexKey)

    for (const key of [keys.fieldKey, keys.blindIndexKey]) {
      expect(key.extractable).toBe(false)
      await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
      await expect(crypto.subtle.exportKey('jwk', key)).rejects.toThrow()
    }
    expect([...keys.fieldKey.usages].sort()).toEqual(['decrypt', 'encrypt'])
    expect(keys.fieldKey.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
    expect([...keys.blindIndexKey.usages]).toEqual(['sign'])
    expect(keys.blindIndexKey.algorithm).toMatchObject({ name: 'HMAC', hash: { name: 'SHA-256' } })
  })

  // Test 13
  it('throws LockedError for every use after lock()', async () => {
    const { keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const sealed = await keyRing.encryptField(utf8('Ada'), BINDING)
    expect(keyRing.locked).toBe(false)

    keyRing.lock()
    keyRing.lock()

    expect(keyRing.locked).toBe(true)
    expect(keyRingInternals.has(keyRing)).toBe(false)
    expect(() => keyRing.encryptField(utf8('Ada'), BINDING)).toThrow(LockedError)
    expect(() => keyRing.decryptField(sealed, BINDING)).toThrow(LockedError)
    expect(() => keyRing.blindIndexKey).toThrow(LockedError)
  })
})
