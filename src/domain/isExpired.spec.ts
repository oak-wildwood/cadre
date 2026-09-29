import { describe, expect, it } from 'vitest'

import { isExpired } from './isExpired'

describe('isExpired', () => {
  const now = new Date('2026-06-01T00:00:00Z')

  it('never expires a member with no expiresAt', () => {
    expect(isExpired({ expiresAt: null }, now)).toBe(false)
  })

  it('is not expired before expiresAt', () => {
    expect(isExpired({ expiresAt: new Date('2026-06-02T00:00:00Z') }, now)).toBe(false)
  })

  it('is expired after expiresAt', () => {
    expect(isExpired({ expiresAt: new Date('2026-05-31T00:00:00Z') }, now)).toBe(true)
  })

  it('is expired at exactly expiresAt', () => {
    expect(isExpired({ expiresAt: now }, now)).toBe(true)
  })
})
