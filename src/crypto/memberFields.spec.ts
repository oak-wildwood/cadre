// @vitest-environment node
import {
  createPassphraseSlot,
  DEFAULT_KDF_PARAMS,
  MIN_KDF_PARAMS,
  readSlotParams,
  unlock,
} from 'keyslot'
import { describe, expect, it } from 'vitest'

import { SENSITIVE_FIELD_NAMES } from '../domain/sensitiveFields'
import {
  decryptMemberFields,
  encryptMemberFields,
  memberBinding,
  newMemberId,
  type SensitiveValues,
} from './memberFields'
import { unlockStore } from './unlockStore'

const FAST = { kdf: MIN_KDF_PARAMS }
const PASSPHRASE = 'fixture passphrase, not a real one'

const VALUES: SensitiveValues = {
  displayName: 'Fixture Person',
  email: 'fixture@example.invalid',
  phone: null,
  role: 'fixture-role',
  notes: 'Fixture notes ✓',
}

describe('member field encryption', () => {
  it('encrypts every sensitive field, keeps null as null, and round-trips', async () => {
    const { keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const id = newMemberId()

    const encrypted = await encryptMemberFields(keyRing, id, VALUES)

    expect(Object.keys(encrypted)).toEqual(SENSITIVE_FIELD_NAMES)
    expect(encrypted.phone).toBeNull()
    expect(encrypted.displayName).toBeInstanceOf(Uint8Array)
    expect(await decryptMemberFields(keyRing, id, encrypted)).toEqual(VALUES)
  })

  it("won't decrypt one member's values as another's, or one field as another", async () => {
    const { keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const id = newMemberId()
    const encrypted = await encryptMemberFields(keyRing, id, VALUES)

    await expect(decryptMemberFields(keyRing, newMemberId(), encrypted)).rejects.toThrow()
    const swapped = { ...encrypted, email: encrypted.role, role: encrypted.email }
    await expect(decryptMemberFields(keyRing, id, swapped)).rejects.toThrow()
  })

  it('binds to the lowercase member UUID and rejects non-UUID ids', () => {
    const id = newMemberId()
    expect(memberBinding(id.toUpperCase(), 'role')).toEqual({
      namespace: 'members',
      recordId: id,
      field: 'role',
    })
    expect(() => memberBinding('42', 'role')).toThrow(TypeError)
  })
})

describe('unlockStore', () => {
  it('re-wraps a slot below the current defaults, keeping the same keys', async () => {
    const { slot, keyRing } = await createPassphraseSlot(PASSPHRASE, FAST)
    const id = newMemberId()
    const encrypted = await encryptMemberFields(keyRing, id, VALUES)

    const { upgradedSlot } = await unlockStore(PASSPHRASE, slot)

    expect(upgradedSlot).not.toBeNull()
    expect(readSlotParams(upgradedSlot!)).toEqual(DEFAULT_KDF_PARAMS)
    const ring = await unlock(PASSPHRASE, upgradedSlot!)
    expect(await decryptMemberFields(ring, id, encrypted)).toEqual(VALUES)

    // A slot already at the defaults is left alone.
    expect((await unlockStore(PASSPHRASE, upgradedSlot!)).upgradedSlot).toBeNull()
  }, 30_000)
})
