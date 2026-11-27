/**
 * Test helper: a `LedgerRepository` made of spies, for component tests. Values are obviously
 * fake (reserved `.invalid` domain), per AGENTS.md rule 2.
 */
import { vi } from 'vitest'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member } from '../domain/member'

export function fakeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Fixture Person',
    email: 'fixture.person@example.invalid',
    phone: '+1 555 0100',
    role: 'zz-fixture-role',
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  }
}

export function fakeRepository(overrides: Partial<LedgerRepository> = {}) {
  return {
    create: vi.fn(async (input) => fakeMember({ ...input, expiresAt: input.expiresAt ?? null })),
    read: vi.fn(async () => null),
    update: vi.fn(async (id, patch) => fakeMember({ id, ...patch })),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ items: [], nextCursor: null })),
    findByBlindIndex: vi.fn(async () => []),
    purgeExpired: vi.fn(async () => ({ purged: 0 })),
    getDefaultRetentionDays: vi.fn(async () => null),
    setDefaultRetentionDays: vi.fn(async () => {}),
    exportEncrypted: vi.fn(async () => new Uint8Array()),
    importEncrypted: vi.fn(async () => ({ imported: 0, skippedExpired: 0 })),
    ...overrides,
  } satisfies LedgerRepository
}
