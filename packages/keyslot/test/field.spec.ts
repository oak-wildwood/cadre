// @vitest-environment node
// Record 0007, decision 12: tests 1, 2, 3, 5, 7, 8, 9 and the decrypt half of 22.
import { beforeAll, describe, expect, it } from 'vitest'

import { DecryptError, UnsupportedFormatError, type KeyRing } from '../src/index'
import { BINDING, flip, newRing, rejection, text, utf8 } from './helpers'

describe('field encryption', () => {
  let ring: KeyRing

  beforeAll(async () => {
    ring = await newRing()
  })

  // Test 1
  it.each([
    ['an ordinary value', 'Ada Lovelace'],
    ['an empty string', ''],
    ['long notes', 'Met at the tenants meeting. '.repeat(400)],
    ['non-ASCII text', 'Zoë Ðorđević 李小龍 👩🏽‍🔧 النص'],
    ['exactly one pad block', 'x'.repeat(32)],
  ])('round-trips %s', async (_label, value) => {
    const sealed = await ring.encryptField(utf8(value), BINDING)
    expect(text(await ring.decryptField(sealed, BINDING))).toBe(value)
  })

  // Test 2: version, nonce, body and tag, each in turn, plus every other byte for good measure.
  it('rejects a value with any single byte changed', async () => {
    const sealed = await ring.encryptField(utf8('organizer'), BINDING)
    const regions = { version: 0, nonce: 5, body: 20, tag: sealed.length - 3 }
    for (const index of Object.values(regions)) {
      await expect(ring.decryptField(flip(sealed, index), BINDING)).rejects.toBeInstanceOf(
        DecryptError,
      )
    }
    for (let index = 0; index < sealed.length; index++) {
      await expect(ring.decryptField(flip(sealed, index), BINDING)).rejects.toThrow()
    }
  })

  // Tests 3 and 7: the binding is part of the AAD.
  it.each([
    ['field', { ...BINDING, field: 'email' }],
    ['record ID (row swap)', { ...BINDING, recordId: '00000000-0000-4000-8000-000000000002' }],
    ['namespace', { ...BINDING, namespace: 'settings' }],
  ])('rejects a wrong %s in the binding', async (_label, wrong) => {
    const sealed = await ring.encryptField(utf8('ada@example.org'), BINDING)
    await expect(ring.decryptField(sealed, wrong)).rejects.toBeInstanceOf(DecryptError)
  })

  it('length-prefixes binding parts so they cannot be re-split', async () => {
    const a = { namespace: 'members', recordId: 'ab', field: 'c' }
    const b = { namespace: 'members', recordId: 'a', field: 'bc' }
    const sealed = await ring.encryptField(utf8('v'), a)
    await expect(ring.decryptField(sealed, b)).rejects.toBeInstanceOf(DecryptError)
  })

  // Test 5
  it('gives different ciphertexts for the same plaintext', async () => {
    const one = await ring.encryptField(utf8('member'), BINDING)
    const two = await ring.encryptField(utf8('member'), BINDING)
    expect(one).not.toEqual(two)
    expect(one.subarray(1, 13)).not.toEqual(two.subarray(1, 13))
  })

  // Test 8
  it('rejects an unknown field-format version', async () => {
    const sealed = await ring.encryptField(utf8('member'), BINDING)
    const newer = sealed.slice()
    newer[0] = 0x02
    await expect(ring.decryptField(newer, BINDING)).rejects.toBeInstanceOf(UnsupportedFormatError)
    const zero = sealed.slice()
    zero[0] = 0x00
    await expect(ring.decryptField(zero, BINDING)).rejects.toBeInstanceOf(DecryptError)
  })

  it('rejects a truncated value', async () => {
    const sealed = await ring.encryptField(utf8('member'), BINDING)
    expect(sealed.length).toBe(61)
    for (const length of [0, 1, 13, 29, 60]) {
      await expect(ring.decryptField(sealed.slice(0, length), BINDING)).rejects.toBeInstanceOf(
        DecryptError,
      )
    }
    const longer = await ring.encryptField(utf8('x'.repeat(40)), BINDING)
    await expect(ring.decryptField(longer.slice(0, 61), BINDING)).rejects.toBeInstanceOf(
      DecryptError,
    )
  })

  // Test 9
  it('pads short values to the same length and longer ones to the next 32 bytes', async () => {
    const member = await ring.encryptField(utf8('member'), BINDING)
    const organizer = await ring.encryptField(utf8('organizer'), BINDING)
    const empty = await ring.encryptField(utf8(''), BINDING)
    const block = await ring.encryptField(utf8('x'.repeat(32)), BINDING)

    expect(member.length).toBe(organizer.length)
    expect(empty.length).toBe(member.length)
    expect(block.length).toBe(member.length + 32)
  })

  it('rejects an empty binding part', async () => {
    await expect(ring.encryptField(utf8('v'), { ...BINDING, recordId: '' })).rejects.toThrow(
      TypeError,
    )
  })

  // Test 22, decrypt half
  it('never puts plaintext in a decrypt error', async () => {
    const secret = 'Ada Lovelace, 12 Secret Street'
    const sealed = await ring.encryptField(utf8(secret), BINDING)
    const error = await rejection(ring.decryptField(flip(sealed, 30), BINDING))
    expect(error).toBeInstanceOf(DecryptError)
    expect(error.cause).toBeUndefined()
    for (const surface of [
      error.message,
      String(error),
      error.stack ?? '',
      JSON.stringify(error),
    ]) {
      expect(surface).not.toContain(secret)
      expect(surface).not.toContain('Ada')
    }
  })
})
