import sodium from 'libsodium-wrappers-sumo'

import { CryptoUnavailableError } from './errors'

let loading: Promise<void> | undefined

/**
 * Loads libsodium and checks for WebCrypto. Throws `CryptoUnavailableError` if either is
 * missing. There is no fallback: no PBKDF2, no weaker settings (record 0007, decision 3).
 */
export function ready(): Promise<void> {
  loading ??= load().catch((error: unknown) => {
    // Let a later call try again (e.g. after a flaky network load); never fall back.
    loading = undefined
    throw error
  })
  return loading
}

async function load(): Promise<void> {
  try {
    await sodium.ready
  } catch {
    throw new CryptoUnavailableError()
  }
  if (
    typeof sodium.crypto_pwhash !== 'function' ||
    typeof sodium.crypto_kdf_derive_from_key !== 'function'
  ) {
    throw new CryptoUnavailableError()
  }
  const webCrypto = globalThis.crypto
  if (!webCrypto?.subtle || typeof webCrypto.getRandomValues !== 'function') {
    throw new CryptoUnavailableError()
  }
}

export { sodium }
