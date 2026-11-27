import type { LedgerRepository } from '../domain/LedgerRepository'
import { DEMO_ROSTER } from './roster'

/** The demo roster is only for an empty store: it never mixes into someone's real members. */
export class DemoStoreNotEmptyError extends Error {
  constructor() {
    super('The demo roster can only be loaded into an empty store.')
    this.name = 'DemoStoreNotEmptyError'
  }
}

/**
 * Writes the demo roster through the repository, so every sensitive field takes the normal
 * encryption path. Refuses a store that already has members, and leaves it unchanged.
 * Returns how many people were added.
 */
export async function loadDemoRoster(
  repository: LedgerRepository,
  now: Date = new Date(),
): Promise<number> {
  const existing = await repository.list({ limit: 1 })
  if (existing.items.length > 0) throw new DemoStoreNotEmptyError()

  // The repository has no multi-row transaction, so undo by hand: a half-loaded roster would
  // leave the store non-empty, hide the loader and refuse a retry.
  const created: string[] = []
  try {
    for (const person of DEMO_ROSTER) {
      const { expiry, ...fields } = person
      if (expiry === 'org-default') {
        // `expiresAt` left out on purpose: the repository applies the org default.
        created.push((await repository.create(fields)).id)
      } else {
        const ms = 'days' in expiry ? expiry.days * 86_400_000 : expiry.seconds * 1000
        created.push(
          (await repository.create({ ...fields, expiresAt: new Date(now.getTime() + ms) })).id,
        )
      }
    }
  } catch (failure) {
    for (const id of created) await repository.delete(id).catch(() => {})
    throw failure
  }
  return DEMO_ROSTER.length
}
