/**
 * Runs `purgeExpired` when the app opens and on a timer while it stays open, and keeps the
 * latest result for a small notice. Timer and clock are injectable so tests can drive both
 * (docs/retention.md).
 */
import { ref, type Ref } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'

export const DEFAULT_PURGE_INTERVAL_MS = 60 * 60 * 1000

export interface RetentionOptions {
  repository: Pick<LedgerRepository, 'purgeExpired'>
  /** Milliseconds between purges while the app is open. Default: one hour. */
  intervalMs?: number
  now?: () => Date
  setInterval?: (callback: () => void, ms: number) => unknown
  clearInterval?: (handle: unknown) => void
  /** Called with the count after every run that purged something. */
  onPurged?: (purged: number) => void
}

export interface Retention {
  /** Purged count from the latest run that purged anything; null once dismissed or before then. */
  notice: Ref<number | null>
  /** The on-open hook: call it once after unlock. Runs a purge now, then starts the timer. */
  start(): Promise<void>
  /** One purge. A failure is swallowed (the next tick retries), never logged with data in it. */
  run(): Promise<number>
  stop(): void
  dismiss(): void
}

export function useRetention(options: RetentionOptions): Retention {
  const {
    repository,
    intervalMs = DEFAULT_PURGE_INTERVAL_MS,
    now = () => new Date(),
    setInterval: schedule = (cb, ms) => globalThis.setInterval(cb, ms),
    clearInterval: cancel = (h) => globalThis.clearInterval(h as number),
    onPurged,
  } = options
  const notice = ref<number | null>(null)
  let handle: unknown = null
  let running: Promise<number> | null = null

  function run(): Promise<number> {
    // Overlapping runs (a slow purge and the next tick) share one result.
    running ??= repository
      .purgeExpired(now())
      .then(({ purged }) => {
        if (purged > 0) {
          notice.value = purged
          onPurged?.(purged)
        }
        return purged
      })
      .catch(() => 0)
      .finally(() => {
        running = null
      })
    return running
  }

  async function start(): Promise<void> {
    if (handle === null) {
      handle = schedule(() => void run(), intervalMs)
    }
    await run()
  }

  function stop(): void {
    if (handle !== null) {
      cancel(handle)
      handle = null
    }
  }

  return { notice, start, run, stop, dismiss: () => (notice.value = null) }
}
