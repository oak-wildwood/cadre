/**
 * What the UI says when something fails. Messages are fixed strings chosen from the error's
 * class: an error's own text is never shown or logged, so nothing from a value or a stack can
 * leak into the page or the console.
 */
import { CryptoUnavailableError, DecryptError, UnlockError } from 'keyslot'

import {
  BundleFormatError,
  BundleVersionError,
  ExportPassphraseTooShortError,
} from '../crypto/exportBundle'
import { StoreNotEmptyError } from '../domain/LedgerRepository'

export const UNLOCK_FAILED =
  'Could not unlock. Check the passphrase and try again. Cadre cannot tell a wrong passphrase from a damaged store.'
export const CRYPTO_UNAVAILABLE =
  "This device can't run Cadre's encryption (it may be short of memory, or the browser lacks WebCrypto). Try another browser or device."
export const SOMETHING_FAILED = 'Something went wrong. Try again.'

/**
 * For unlock and first-run create. Everything except "this device can't run the encryption"
 * reads the same, so the message never tells a wrong passphrase from a damaged or missing store
 * (record 0007, decision 8).
 */
export function unlockMessage(error: unknown): string {
  return error instanceof CryptoUnavailableError ? CRYPTO_UNAVAILABLE : UNLOCK_FAILED
}

export function importMessage(error: unknown): string {
  if (error instanceof StoreNotEmptyError) {
    return 'This store already has members. Tick "Replace all current members" to import over them.'
  }
  if (error instanceof BundleVersionError) {
    return 'This export was made by a newer version of Cadre. Update Cadre to import it.'
  }
  if (error instanceof BundleFormatError || error instanceof DecryptError) {
    return "That file isn't a Cadre export, or it is damaged."
  }
  if (error instanceof UnlockError) {
    return 'Could not open the export. Check its passphrase, or the file may be damaged.'
  }
  return errorMessage(error)
}

export function exportMessage(error: unknown): string {
  if (error instanceof ExportPassphraseTooShortError) {
    return error.message
  }
  return errorMessage(error)
}

export function errorMessage(error: unknown): string {
  return error instanceof CryptoUnavailableError ? CRYPTO_UNAVAILABLE : SOMETHING_FAILED
}
