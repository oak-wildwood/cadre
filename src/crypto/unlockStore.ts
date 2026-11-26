import {
  DEFAULT_KDF_PARAMS,
  readSlotParams,
  rewrapPassphraseSlot,
  unlock,
  type KeyRing,
} from 'keyslot'

export interface UnlockedStore {
  keyRing: KeyRing
  /**
   * Set when the stored slot was below the current Argon2id defaults: the same master key,
   * re-wrapped at the defaults. The caller writes it back to `key_slots`. No field is
   * re-encrypted. `null` when the slot is already current.
   */
  upgradedSlot: Uint8Array | null
}

/**
 * Unlocks with the settings stored in the slot, then re-wraps it at the current defaults if
 * it is weaker (record 0007, decision 2). This lets the defaults be raised in a later release
 * without breaking old stores.
 */
export async function unlockStore(passphrase: string, slot: Uint8Array): Promise<UnlockedStore> {
  const keyRing = await unlock(passphrase, slot)
  const stored = readSlotParams(slot)
  const belowDefaults =
    stored.opslimit < DEFAULT_KDF_PARAMS.opslimit || stored.memlimit < DEFAULT_KDF_PARAMS.memlimit
  const upgradedSlot = belowDefaults
    ? await rewrapPassphraseSlot(passphrase, slot, passphrase)
    : null
  return { keyRing, upgradedSlot }
}
