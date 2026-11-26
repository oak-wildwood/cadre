import { describe, expect, it } from 'vitest'

import { decodeExportPayload, encodeExportPayload, ExportPayloadError } from './exportPayload'
import type { Member } from './member'

const member: Member = {
  id: '0000000a-0000-4000-8000-00000000000b',
  displayName: 'Payload Fixture',
  email: 'payload.fixture@example.invalid',
  phone: null,
  role: 'zz-fixture-role',
  notes: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  updatedAt: new Date('2026-11-02T00:00:00.000Z'),
  expiresAt: null,
}
const exportedAt = new Date('2026-11-26T00:00:00.000Z')

function json(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

function raw(): { exportedAt: string; members: Record<string, unknown>[] } {
  return JSON.parse(
    new TextDecoder().decode(encodeExportPayload({ exportedAt, members: [member] })),
  )
}

describe('export payload', () => {
  it('round-trips', () => {
    const bytes = encodeExportPayload({ exportedAt, members: [member] })
    expect(decodeExportPayload(bytes)).toEqual({ exportedAt, members: [member] })
  })

  it('writes the documented shape', () => {
    expect(raw()).toEqual({
      exportedAt: '2026-11-26T00:00:00.000Z',
      members: [
        {
          id: member.id,
          displayName: 'Payload Fixture',
          email: 'payload.fixture@example.invalid',
          phone: null,
          role: 'zz-fixture-role',
          notes: null,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-02T00:00:00.000Z',
          expiresAt: null,
        },
      ],
    })
  })

  it('rejects unknown and missing keys at both levels', () => {
    const cases = [
      { ...raw(), extra: 1 },
      { members: [] },
      { ...raw(), members: [{ ...raw().members[0], extra: 1 }] },
      { ...raw(), members: [{ ...raw().members[0], notes: undefined }] },
    ]
    for (const value of cases) {
      expect(() => decodeExportPayload(json(value))).toThrow(ExportPayloadError)
    }
  })

  it('rejects wrong types, bad ids, bad timestamps and duplicate ids', () => {
    const base = raw().members[0]!
    const bad: Record<string, unknown>[] = [
      { ...base, id: 'not-a-uuid' },
      { ...base, id: base.id!.toString().toUpperCase() },
      { ...base, displayName: null },
      { ...base, email: 42 },
      { ...base, createdAt: '2026-11-01' },
      { ...base, updatedAt: '2026-02-30T00:00:00.000Z' },
      { ...base, expiresAt: 0 },
    ]
    for (const m of bad) {
      expect(() => decodeExportPayload(json({ ...raw(), members: [m] }))).toThrow(
        ExportPayloadError,
      )
    }
    expect(() => decodeExportPayload(json({ ...raw(), members: [base, base] }))).toThrow(
      /duplicate/,
    )
    expect(() => decodeExportPayload(json({ ...raw(), members: {} }))).toThrow(ExportPayloadError)
  })

  it('rejects non-JSON and invalid UTF-8', () => {
    expect(() => decodeExportPayload(new TextEncoder().encode('{'))).toThrow(ExportPayloadError)
    expect(() => decodeExportPayload(new Uint8Array([0xff]))).toThrow(ExportPayloadError)
  })

  it('never puts a value into an error message', () => {
    const m = { ...raw().members[0], email: { secret: 'payload.fixture@example.invalid' } }
    const error = (() => {
      try {
        decodeExportPayload(json({ ...raw(), members: [m] }))
      } catch (e) {
        return e as Error
      }
    })()
    expect(error?.message).not.toContain('payload.fixture')
  })
})
