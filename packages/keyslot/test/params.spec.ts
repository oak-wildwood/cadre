// @vitest-environment node
// Record 0007, decision 12: tests 6, 15 and 16.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createPassphraseSlot,
  DEFAULT_KDF_PARAMS,
  MAX_KDF_PARAMS,
  MIN_KDF_PARAMS,
  readSlotParams,
  rewrapPassphraseSlot,
  unlock,
  UnlockError,
} from '../src/index'
import { sodium } from '../src/sodium'
import { BINDING, FAST, PASSPHRASE, text, utf8 } from './helpers'

function withParams(slot: Uint8Array, opslimit: number, memlimit: number): Uint8Array {
  const copy = slot.slice()
  const view = new DataView(copy.buffer)
  view.setUint32(3, opslimit, false)
  view.setUint32(7, memlimit, false)
  return copy
}

describe('Argon2id settings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test 6
  it('defaults to libsodium MODERATE, as literal numbers', async () => {
    await sodium.ready
    expect(DEFAULT_KDF_PARAMS).toEqual({ algorithm: 2, opslimit: 3, memlimit: 268435456 })
    expect(DEFAULT_KDF_PARAMS).toEqual({
      algorithm: sodium.crypto_pwhash_ALG_ARGON2ID13,
      opslimit: sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      memlimit: sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    })
    expect(MIN_KDF_PARAMS).toEqual({
      algorithm: 2,
      opslimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      memlimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    })
    expect(MAX_KDF_PARAMS).toEqual({
      algorithm: 2,
      opslimit: sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
      memlimit: sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
    })
    expect(sodium.crypto_pwhash_SALTBYTES).toBe(16)
  })

  it('uses the defaults for a new slot when no settings are given', async () => {
    const { slot, keyRing } = await createPassphraseSlot(PASSPHRASE)
    expect(readSlotParams(slot)).toEqual(DEFAULT_KDF_PARAMS)
    const sealed = await keyRing.encryptField(utf8('Ada'), BINDING)
    const ring = await unlock(PASSPHRASE, slot)
    expect(text(await ring.decryptField(sealed, BINDING))).toBe('Ada')
  }, 20_000)

  // Test 15
  it.each([
    ['opslimit below the floor', 1, MIN_KDF_PARAMS.memlimit],
    ['memlimit below the floor', MIN_KDF_PARAMS.opslimit, MIN_KDF_PARAMS.memlimit - 1024],
    ['opslimit above the ceiling', 5, MIN_KDF_PARAMS.memlimit],
    ['memlimit above the ceiling', MIN_KDF_PARAMS.opslimit, MAX_KDF_PARAMS.memlimit + 1024],
    ['an absurd opslimit', 0xffffffff, MIN_KDF_PARAMS.memlimit],
  ])('rejects a stored slot with %s, without running Argon2id', async (_label, ops, mem) => {
    const { slot } = await createPassphraseSlot(PASSPHRASE, FAST)
    const pwhash = vi.spyOn(sodium, 'crypto_pwhash')

    await expect(unlock(PASSPHRASE, withParams(slot, ops, mem))).rejects.toBeInstanceOf(UnlockError)
    expect(() => readSlotParams(withParams(slot, ops, mem))).toThrow(UnlockError)
    expect(pwhash).not.toHaveBeenCalled()
  })

  it('refuses to create or re-wrap a slot outside the allowed range', async () => {
    const pwhash = vi.spyOn(sodium, 'crypto_pwhash')
    const tooWeak = { kdf: { ...MIN_KDF_PARAMS, opslimit: 1 } }
    const tooStrong = { kdf: { ...MAX_KDF_PARAMS, memlimit: MAX_KDF_PARAMS.memlimit * 2 } }
    const otherAlgorithm = { kdf: { ...MIN_KDF_PARAMS, algorithm: 1 } }

    for (const options of [tooWeak, tooStrong, otherAlgorithm]) {
      await expect(createPassphraseSlot(PASSPHRASE, options)).rejects.toThrow(RangeError)
    }
    expect(pwhash).not.toHaveBeenCalled()

    const { slot } = await createPassphraseSlot(PASSPHRASE, FAST)
    pwhash.mockClear()
    await expect(rewrapPassphraseSlot(PASSPHRASE, slot, PASSPHRASE, tooWeak)).rejects.toThrow(
      RangeError,
    )
    expect(pwhash).not.toHaveBeenCalled()
  })

  // Test 16
  it('unlocks with the settings stored in the slot, not the current defaults', async () => {
    const custom = { algorithm: 2, opslimit: 2, memlimit: 96 * 1024 * 1024 }
    const { slot, keyRing } = await createPassphraseSlot(PASSPHRASE, { kdf: custom })
    const sealed = await keyRing.encryptField(utf8('Ada'), BINDING)
    expect(readSlotParams(slot)).toEqual(custom)

    // The slot's settings differ from DEFAULT_KDF_PARAMS on both axes, as they would after a
    // later release raised the defaults. Unlock must run Argon2id with the stored ones.
    expect(custom.opslimit).not.toBe(DEFAULT_KDF_PARAMS.opslimit)
    expect(custom.memlimit).not.toBe(DEFAULT_KDF_PARAMS.memlimit)
    expect(Object.isFrozen(DEFAULT_KDF_PARAMS)).toBe(true)

    const pwhash = vi.spyOn(sodium, 'crypto_pwhash')
    const ring = await unlock(PASSPHRASE, slot)
    expect(text(await ring.decryptField(sealed, BINDING))).toBe('Ada')
    expect(pwhash).toHaveBeenCalledTimes(1)
    const [, , , opslimit, memlimit, algorithm] = pwhash.mock.calls[0]!
    expect({ opslimit, memlimit, algorithm }).toEqual({
      opslimit: custom.opslimit,
      memlimit: custom.memlimit,
      algorithm: custom.algorithm,
    })
  })
})
