/**
 * The JSON payload inside a version-1 export bundle (record 0010, decision 4;
 * `docs/export-format.md`). It holds member rows with their sensitive fields in plaintext, so it
 * must only ever exist in memory or inside the encrypted bundle. Never log it.
 *
 * Decoding is strict: an unknown, missing or repeated key, a value of the wrong type, or any
 * byte that differs from the canonical encoding is rejected, so a reader never silently drops
 * data a newer writer added. Error messages name an expected key, never a value or an unknown key.
 */
import type { Member } from './member'

export interface ExportPayload {
  exportedAt: Date
  members: Member[]
}

export class ExportPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportPayloadError'
  }
}

const PAYLOAD_KEYS = ['exportedAt', 'members'] as const
const MEMBER_KEYS = [
  'id',
  'displayName',
  'email',
  'phone',
  'role',
  'notes',
  'createdAt',
  'updatedAt',
  'expiresAt',
] as const
const NULLABLE_STRINGS = ['email', 'phone', 'role', 'notes'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// Exactly what Date.prototype.toISOString produces: four-digit years, or a sign and six digits
// for years outside 0000-9999 (which a valid JS Date, and Postgres, can hold).
const ISO_UTC = /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function encodeExportPayload(payload: ExportPayload): Uint8Array {
  const json = {
    exportedAt: payload.exportedAt.toISOString(),
    members: payload.members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      email: m.email,
      phone: m.phone,
      role: m.role,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      expiresAt: m.expiresAt === null ? null : m.expiresAt.toISOString(),
    })),
  }
  return new TextEncoder().encode(JSON.stringify(json))
}

export function decodeExportPayload(bytes: Uint8Array): ExportPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new ExportPayloadError('Export payload is not valid UTF-8 JSON')
  }
  const root = checkObject(parsed, PAYLOAD_KEYS, 'payload')
  if (!Array.isArray(root.members)) {
    throw new ExportPayloadError('Export payload key "members" must be an array')
  }
  const seen = new Set<string>()
  const members = root.members.map((value, i) => {
    const member = decodeMember(value, `members[${i}]`)
    if (seen.has(member.id)) {
      throw new ExportPayloadError(`Export payload has a duplicate id at members[${i}]`)
    }
    seen.add(member.id)
    return member
  })
  const payload = { exportedAt: checkDate(root.exportedAt, 'exportedAt'), members }
  // JSON.parse keeps the last of two repeated keys silently. Requiring the bytes to be exactly
  // the canonical encoding rejects repeats, reordering and extra whitespace in one check.
  const canonical = encodeExportPayload(payload)
  try {
    if (canonical.length !== bytes.length || canonical.some((byte, i) => byte !== bytes[i])) {
      throw new ExportPayloadError('Export payload is not in canonical form')
    }
  } finally {
    canonical.fill(0)
  }
  return payload
}

function decodeMember(value: unknown, where: string): Member {
  const m = checkObject(value, MEMBER_KEYS, where)
  if (typeof m.id !== 'string' || !UUID.test(m.id)) {
    throw new ExportPayloadError(`Export payload ${where}.id must be a lowercase UUID`)
  }
  if (typeof m.displayName !== 'string') {
    throw new ExportPayloadError(`Export payload ${where}.displayName must be a string`)
  }
  for (const key of NULLABLE_STRINGS) {
    if (m[key] !== null && typeof m[key] !== 'string') {
      throw new ExportPayloadError(`Export payload ${where}.${key} must be a string or null`)
    }
  }
  return {
    id: m.id,
    displayName: m.displayName,
    email: m.email as string | null,
    phone: m.phone as string | null,
    role: m.role as string | null,
    notes: m.notes as string | null,
    createdAt: checkDate(m.createdAt, `${where}.createdAt`),
    updatedAt: checkDate(m.updatedAt, `${where}.updatedAt`),
    expiresAt: m.expiresAt === null ? null : checkDate(m.expiresAt, `${where}.expiresAt`),
  }
}

function checkObject<K extends string>(
  value: unknown,
  keys: readonly K[],
  where: string,
): Record<K, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExportPayloadError(`Export payload ${where} must be an object`)
  }
  const actual = Object.keys(value)
  const unknown = actual.find((key) => !(keys as readonly string[]).includes(key))
  if (unknown !== undefined) {
    throw new ExportPayloadError(`Export payload ${where} has an unknown key`)
  }
  const missing = keys.find((key) => !actual.includes(key))
  if (missing !== undefined) {
    throw new ExportPayloadError(`Export payload ${where} is missing "${missing}"`)
  }
  return value as Record<K, unknown>
}

function checkDate(value: unknown, where: string): Date {
  const date = typeof value === 'string' && ISO_UTC.test(value) ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new ExportPayloadError(`Export payload ${where} must be an ISO 8601 UTC timestamp`)
  }
  return date
}
