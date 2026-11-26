// @vitest-environment node
// Record 0007, decision 12: test 17. Fail closed; never fall back to PBKDF2.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('libsodium-wrappers-sumo', () => ({
  default: {
    get ready() {
      return Promise.reject(new Error('WebAssembly blocked by CSP'))
    },
  },
}))

describe('when libsodium cannot load', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ready(), createPassphraseSlot() and unlock() throw CryptoUnavailableError, with no PBKDF2', async () => {
    const subtle = globalThis.crypto.subtle
    const spies = [
      vi.spyOn(subtle, 'deriveBits'),
      vi.spyOn(subtle, 'deriveKey'),
      vi.spyOn(subtle, 'importKey'),
    ]
    const { ready, createPassphraseSlot, unlock, CryptoUnavailableError } =
      await import('../src/index')

    await expect(ready()).rejects.toBeInstanceOf(CryptoUnavailableError)
    await expect(createPassphraseSlot('a long enough passphrase')).rejects.toBeInstanceOf(
      CryptoUnavailableError,
    )
    await expect(unlock('a long enough passphrase', new Uint8Array(87))).rejects.toBeInstanceOf(
      CryptoUnavailableError,
    )
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
    }
  })
})

describe('when WebCrypto is missing (not a secure context)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('ready() throws CryptoUnavailableError', async () => {
    vi.doUnmock('libsodium-wrappers-sumo')
    vi.resetModules()
    vi.stubGlobal('crypto', { getRandomValues: () => new Uint8Array(0) })
    const { ready, CryptoUnavailableError } = await import('../src/index')
    await expect(ready()).rejects.toBeInstanceOf(CryptoUnavailableError)
  })
})
