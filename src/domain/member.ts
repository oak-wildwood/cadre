export type MemberId = string

/**
 * Fields whose plaintext must never reach storage. This is the interim
 * source of truth until `sensitiveFields.ts` lands (separate issue); adapters
 * enforce the actual encrypt/blind-index behavior, this type just names
 * which `Member` fields `findByBlindIndex` may be called with.
 */
export type SensitiveField = 'displayName' | 'email' | 'phone' | 'notes'

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
