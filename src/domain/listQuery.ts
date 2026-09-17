/**
 * Filter and sort fields are restricted to structural, non-sensitive
 * `Member` columns. Looking up a member by a sensitive field (name, email,
 * phone, notes) goes through `LedgerRepository.findByBlindIndex` instead,
 * which is equality-only by design — see the repository interface decision
 * record.
 */
export type ListOrderField = 'createdAt' | 'updatedAt' | 'expiresAt'

export interface ListFilter {
  expiresBefore?: Date
  expiresAfter?: Date
}

export interface ListQuery {
  limit?: number
  cursor?: string | null
  orderBy?: ListOrderField
  orderDirection?: 'asc' | 'desc'
  filter?: ListFilter
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
