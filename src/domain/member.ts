export type MemberId = string

/** Defined, with which fields are blind-indexed, in `sensitiveFields.ts`. */
export type { SensitiveField, BlindIndexedField } from './sensitiveFields'

export interface Member {
  id: MemberId
  displayName: string
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
}

export type NewMember = Omit<Member, 'id' | 'createdAt' | 'updatedAt'>

export type MemberPatch = Partial<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>>
