// @vitest-environment node
import * as keyslot from 'keyslot'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { unlockStore } from './unlockStore'

vi.mock('keyslot', async (importOriginal) => {
  const actual = await importOriginal<typeof keyslot>()
  return { ...actual, rewrapPassphraseSlot: vi.fn(actual.rewrapPassphraseSlot) }
})

const PASSPHRASE = 'fixture passphrase, not a real one'
const BINDING = {
  namespace: 'members',
  recordId: '00000000-0000-4000-8000-000000000001',
  field: 'displayName',
}

describe('unlockStore when the upgrade fails', () => {
  afterEach(() => {
    vi.mocked(keyslot.rewrapPassphraseSlot).mockReset()
  })

  it('keeps a successful unlock if the device cannot run the default settings', async () => {
    const { slot, keyRing } = await keyslot.createPassphraseSlot(PASSPHRASE, {
      kdf: keyslot.MIN_KDF_PARAMS,
    })
    const sealed = await keyRing.encryptField(new TextEncoder().encode('Ada'), BINDING)
    vi.mocked(keyslot.rewrapPassphraseSlot).mockRejectedValueOnce(
      new keyslot.CryptoUnavailableError(),
    )

    const result = await unlockStore(PASSPHRASE, slot)

    expect(keyslot.rewrapPassphraseSlot).toHaveBeenCalledTimes(1)
    expect(result.upgradedSlot).toBeNull()
    expect(result.keyRing.locked).toBe(false)
    expect(new TextDecoder().decode(await result.keyRing.decryptField(sealed, BINDING))).toBe('Ada')
  })

  it('locks the ring before rethrowing any other failure', async () => {
    const { slot } = await keyslot.createPassphraseSlot(PASSPHRASE, {
      kdf: keyslot.MIN_KDF_PARAMS,
    })
    const ring = vi.spyOn(keyslot, 'unlock')
    vi.mocked(keyslot.rewrapPassphraseSlot).mockRejectedValueOnce(new Error('boom'))

    await expect(unlockStore(PASSPHRASE, slot)).rejects.toThrow('boom')
    const unlocked = (await ring.mock.results[0]!.value) as keyslot.KeyRing
    expect(unlocked.locked).toBe(true)
  })
})
