// @vitest-environment node
import { createPassphraseSlot, MIN_KDF_PARAMS } from 'keyslot'
import { afterEach, describe, expect, it } from 'vitest'

import { PGliteRepository } from '../storage/PGliteRepository'
import { DemoStoreNotEmptyError, loadDemoRoster } from './loadDemoRoster'
import { DEMO_CASES, DEMO_ROLES, DEMO_ROSTER } from './roster'

const { keyRing } = await createPassphraseSlot('test passphrase, not real', { kdf: MIN_KDF_PARAMS })

const open: PGliteRepository[] = []
function makeRepo() {
  const repo = new PGliteRepository({ keyRing, exportKdf: MIN_KDF_PARAMS })
  open.push(repo)
  return repo
}
afterEach(async () => {
  await Promise.all(open.splice(0).map((r) => r.close()))
})

describe('demo roster seed rules', () => {
  it('has sixteen distinct people, all long dead, with display-only names', () => {
    expect(DEMO_ROSTER).toHaveLength(16)
    const names = DEMO_ROSTER.map((p) => p.displayName)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^\p{Lu}\p{L}+( \p{Lu}\p{L}*)+$/u)
  })

  it('uses only reserved emails and 555-01xx phones', () => {
    for (const p of DEMO_ROSTER) {
      if (p.email !== null) expect(p.email).toMatch(/^[a-z.]+@example\.invalid$/)
      if (p.phone !== null) expect(p.phone).toMatch(/^\+1-555-01\d\d$/)
    }
  })

  it('keeps contact details and URLs out of the free text', () => {
    for (const p of DEMO_ROSTER) {
      expect(p.notes).not.toMatch(/@|https?:|www\.|\d{3}[-. ]?\d{4}/)
    }
  })

  it('gives every person a known role and a first line naming a known case', () => {
    for (const p of DEMO_ROSTER) {
      expect(DEMO_ROLES).toContain(p.role)
      const [first, ...rest] = p.notes.split('\n')
      expect(DEMO_CASES.map((c) => `Case: ${c}`)).toContain(first)
      for (const line of rest.filter((l) => l.startsWith('Also in: '))) {
        expect(DEMO_CASES).toContain(line.slice('Also in: '.length))
      }
    }
    expect(new Set(DEMO_ROSTER.map((p) => p.role))).toEqual(new Set(DEMO_ROLES))
    expect(DEMO_ROSTER.filter((p) => p.notes.includes('\nAlso in: ')).length).toBeGreaterThan(0)
  })

  it('has two records expiring a minute after load and one taking the org default', () => {
    const soon = DEMO_ROSTER.filter((p) => typeof p.expiry === 'object' && 'seconds' in p.expiry)
    expect(soon).toHaveLength(2)
    expect(DEMO_ROSTER.filter((p) => p.expiry === 'org-default')).toHaveLength(1)
  })
})

describe('loadDemoRoster', () => {
  it('writes the roster through the repository, readable after decrypting', async () => {
    const repo = makeRepo()
    await repo.setDefaultRetentionDays(30)
    const now = new Date()
    expect(await loadDemoRoster(repo, now)).toBe(16)

    const { items } = await repo.list({ limit: 50 })
    expect(items).toHaveLength(16)
    expect(items.find((m) => m.displayName === 'John Brown')?.role).toBe('organizer')

    const soon = items.filter(
      (m) => m.expiresAt && m.expiresAt.getTime() - now.getTime() === 60_000,
    )
    expect(soon).toHaveLength(2)
    const defaulted = items.find((m) => m.displayName === 'Fidel Castro')
    expect(defaulted?.expiresAt?.getTime()).toBeGreaterThan(now.getTime() + 29 * 86_400_000)
    expect(defaulted?.expiresAt?.getTime()).toBeLessThan(now.getTime() + 31 * 86_400_000)

    // Exact-match search works on the seeded rows; the two short-lived ones purge later.
    expect(await repo.findByBlindIndex('email', 'JOHN.BROWN@example.invalid')).toHaveLength(1)
    expect(await repo.findByBlindIndex('displayName', 'John')).toEqual([])
    expect((await repo.purgeExpired(new Date(now.getTime() + 61_000))).purged).toBe(2)
  })

  it('is refused, with nothing added, when the store already has a member', async () => {
    const repo = makeRepo()
    await repo.create({
      displayName: 'Existing Person',
      email: null,
      phone: null,
      role: null,
      notes: null,
    })
    await expect(loadDemoRoster(repo)).rejects.toBeInstanceOf(DemoStoreNotEmptyError)
    expect((await repo.list({ limit: 50 })).items).toHaveLength(1)
  })

  it('puts the store back to empty if writing fails partway', async () => {
    const repo = makeRepo()
    const create = repo.create.bind(repo)
    let calls = 0
    repo.create = (input) => {
      if (++calls === 5) return Promise.reject(new Error('quota'))
      return create(input)
    }
    await expect(loadDemoRoster(repo)).rejects.toThrow('quota')
    expect((await repo.list({ limit: 50 })).items).toHaveLength(0)
  })
})
