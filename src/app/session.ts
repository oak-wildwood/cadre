/**
 * The unlock session: opens the store, creates or unlocks it with a passphrase, and owns the
 * keys and the repository until `lock()`. Locking closes the database, wipes the key ring and
 * forgets the repository, so nothing readable stays in memory behind the Unlock screen.
 *
 * UI code reaches data only through `session.repository` (a `LedgerRepository`, AGENTS.md
 * rule 5). Messages set here never contain a passphrase, a member field or a database error's
 * text, and nothing in this file logs.
 */
import {
  createPassphraseSlot,
  CryptoUnavailableError,
  UnsupportedFormatError,
  type KdfParams,
  type KeyRing,
} from 'keyslot'
import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

import { unlockStore } from '../crypto/unlockStore'
import type { LedgerRepository } from '../domain/LedgerRepository'
import { KeySlotStore } from '../storage/keySlotStore'
import { DEFAULT_DATA_DIR, PGliteRepository } from '../storage/PGliteRepository'
import { useRetention, type Retention } from './retention'

/** A new store's passphrase must be at least this many characters (same rule as exports). */
export const MIN_STORE_PASSPHRASE_LENGTH = 15

/** One message for every way unlocking can fail except a newer-format store: never a hint. */
export const UNLOCK_FAILED = 'Could not unlock. Check the passphrase and try again.'
const NEWER_FORMAT = 'This store was made by a newer version of Cadre. Update Cadre to open it.'
const UNAVAILABLE = 'This browser cannot run the encryption Cadre needs.'

export class PassphraseTooShortError extends Error {
  constructor() {
    super(`Use at least ${MIN_STORE_PASSPHRASE_LENGTH} characters.`)
    this.name = 'PassphraseTooShortError'
  }
}

export interface SessionOptions {
  /** `idb://<name>` by default; `memory://` for tests. */
  dataDir?: string
  /** Argon2id settings for a *new* store and for exports. Tests lower them; real use omits it. */
  kdf?: KdfParams
}

export interface Session {
  /** `null` until `init()` has looked, then whether a store already exists on this device. */
  hasStore: Ref<boolean | null>
  unlocked: Ref<boolean>
  busy: Ref<boolean>
  /** A user-facing message for the last failed attempt; cleared by the next one. */
  error: Ref<string | null>
  repository: ShallowRef<LedgerRepository | null>
  retention: Retention
  /** Bumped when a background purge removed rows, so open lists reload. */
  dataVersion: Ref<number>
  init(): Promise<void>
  create(passphrase: string): Promise<boolean>
  unlock(passphrase: string): Promise<boolean>
  lock(): Promise<void>
  /** Like `lock`, but also releases the database and does not reopen it. For unmounting. */
  close(): Promise<void>
}

export function createSession(options: SessionOptions = {}): Session {
  const dataDir = options.dataDir ?? DEFAULT_DATA_DIR
  const hasStore = ref<boolean | null>(null)
  const unlocked = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  const repository = shallowRef<LedgerRepository | null>(null)
  const dataVersion = ref(0)

  let slots: KeySlotStore | null = null
  let keyRing: KeyRing | null = null
  let opened: PGliteRepository | null = null
  // The retention scheduler is bound to whichever repository is current.
  let retention = makeRetention(null)

  const retentionProxy: Retention = {
    notice: ref<number | null>(null),
    start: () => retention.start(),
    run: () => retention.run(),
    stop: () => retention.stop(),
    dismiss: () => {
      retention.dismiss()
      retentionProxy.notice.value = null
    },
  }

  function makeRetention(repo: LedgerRepository | null): Retention {
    return useRetention({
      repository: repo ?? { purgeExpired: () => Promise.resolve({ purged: 0 }) },
      onPurged: (purged) => {
        retentionProxy.notice.value = purged
        dataVersion.value += 1
      },
    })
  }

  async function openSlots(): Promise<KeySlotStore> {
    slots ??= await KeySlotStore.open({ dataDir })
    return slots
  }

  async function init(): Promise<void> {
    const store = await openSlots()
    hasStore.value = (await store.readSlot()) !== null
  }

  /** Releases everything, including after a half-finished attempt. */
  async function teardown(): Promise<void> {
    retention.stop()
    retention = makeRetention(null)
    keyRing?.lock()
    keyRing = null
    repository.value = null
    unlocked.value = false
    const repo = opened
    const store = slots
    opened = null
    slots = null
    // The repository owns the shared database once it exists; close the slot store otherwise.
    await (repo ? repo.close() : store?.close())?.catch(() => {})
  }

  async function finishOpen(ring: KeyRing, store: KeySlotStore): Promise<void> {
    keyRing = ring
    opened = new PGliteRepository({ keyRing: ring, db: store.db, exportKdf: options.kdf })
    await opened.ready()
    repository.value = opened
    retention = makeRetention(opened)
    unlocked.value = true
    await retention.start()
  }

  function describe(failure: unknown): string {
    if (failure instanceof PassphraseTooShortError) return failure.message
    if (failure instanceof UnsupportedFormatError) return NEWER_FORMAT
    if (failure instanceof CryptoUnavailableError) return UNAVAILABLE
    // Wrong passphrase, damaged slot and a corrupt store all land here, on purpose.
    return UNLOCK_FAILED
  }

  async function attempt(work: () => Promise<void>): Promise<boolean> {
    if (busy.value || unlocked.value) return false
    busy.value = true
    error.value = null
    try {
      await work()
      return true
    } catch (failure) {
      error.value = describe(failure)
      await teardown()
      await init().catch(() => {})
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    hasStore,
    unlocked,
    busy,
    error,
    repository,
    retention: retentionProxy,
    dataVersion,
    init,
    create: (passphrase) =>
      attempt(async () => {
        if ([...passphrase.normalize('NFC')].length < MIN_STORE_PASSPHRASE_LENGTH) {
          throw new PassphraseTooShortError()
        }
        const store = await openSlots()
        if ((await store.readSlot()) !== null) {
          throw new Error('store exists')
        }
        const { slot, keyRing: ring } = await createPassphraseSlot(
          passphrase,
          options.kdf ? { kdf: options.kdf } : undefined,
        )
        try {
          await store.writeSlot(slot)
          await finishOpen(ring, store)
        } catch (failure) {
          ring.lock()
          throw failure
        }
        hasStore.value = true
      }),
    unlock: (passphrase) =>
      attempt(async () => {
        const store = await openSlots()
        const slot = await store.readSlot()
        if (slot === null) {
          throw new Error('no store')
        }
        const { keyRing: ring, upgradedSlot } = await unlockStore(passphrase, slot)
        try {
          if (upgradedSlot) await store.writeSlot(upgradedSlot)
          await finishOpen(ring, store)
        } catch (failure) {
          ring.lock()
          throw failure
        }
      }),
    async close() {
      await teardown()
      retentionProxy.notice.value = null
    },
    async lock() {
      await teardown()
      retentionProxy.notice.value = null
      error.value = null
      await init().catch(() => {})
    },
  }
}
