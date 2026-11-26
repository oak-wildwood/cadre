import type { Member } from './member'

/**
 * The single list of sensitive `Member` fields (AGENTS.md invariant; record 0007, decision 9).
 * Column names, adapter encryption and UI masking all derive from this. A PII field added
 * anywhere else ships in plaintext.
 *
 * Every field here is encrypted into a `<column>_enc bytea` column. Only `blindIndexed` fields
 * also get a `<column>_bidx` column for equality search. `role` and `notes` are deliberately
 * not indexed: a role index sorts members into small, targetable groups, and a notes index
 * reveals identical notes.
 *
 * Field names are part of each value's AAD, so renaming one needs a re-encrypting migration.
 */
export const SENSITIVE_FIELDS = {
  displayName: { column: 'display_name', blindIndexed: true },
  email: { column: 'email', blindIndexed: true },
  phone: { column: 'phone', blindIndexed: true },
  role: { column: 'role', blindIndexed: false },
  notes: { column: 'notes', blindIndexed: false },
} as const satisfies Partial<Record<keyof Member, { column: string; blindIndexed: boolean }>>

export type SensitiveField = keyof typeof SENSITIVE_FIELDS

export type BlindIndexedField = {
  [K in SensitiveField]: (typeof SENSITIVE_FIELDS)[K]['blindIndexed'] extends true ? K : never
}[SensitiveField]

export const SENSITIVE_FIELD_NAMES = Object.keys(SENSITIVE_FIELDS) as SensitiveField[]

export const BLIND_INDEXED_FIELDS = SENSITIVE_FIELD_NAMES.filter(
  (field) => SENSITIVE_FIELDS[field].blindIndexed,
) as BlindIndexedField[]

export function encryptedColumn(field: SensitiveField): string {
  return `${SENSITIVE_FIELDS[field].column}_enc`
}

export function blindIndexColumn(field: BlindIndexedField): string {
  return `${SENSITIVE_FIELDS[field].column}_bidx`
}
