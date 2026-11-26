// Record 0007, decision 12, test 24 (the schema half lives in src/storage/migrate.spec.ts).
import { describe, expect, it } from 'vitest'

import {
  BLIND_INDEXED_FIELDS,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_FIELDS,
  blindIndexColumn,
  encryptedColumn,
} from './sensitiveFields'

describe('sensitiveFields', () => {
  it('matches the table in record 0007, decision 9, exactly', () => {
    expect(SENSITIVE_FIELDS).toEqual({
      displayName: { column: 'display_name', blindIndexed: true },
      email: { column: 'email', blindIndexed: true },
      phone: { column: 'phone', blindIndexed: true },
      role: { column: 'role', blindIndexed: false },
      notes: { column: 'notes', blindIndexed: false },
    })
    expect(SENSITIVE_FIELD_NAMES).toEqual(['displayName', 'email', 'phone', 'role', 'notes'])
    expect(BLIND_INDEXED_FIELDS).toEqual(['displayName', 'email', 'phone'])
  })

  it('names the columns each field is stored in', () => {
    expect(SENSITIVE_FIELD_NAMES.map(encryptedColumn)).toEqual([
      'display_name_enc',
      'email_enc',
      'phone_enc',
      'role_enc',
      'notes_enc',
    ])
    expect(BLIND_INDEXED_FIELDS.map(blindIndexColumn)).toEqual([
      'display_name_bidx',
      'email_bidx',
      'phone_bidx',
    ])
  })
})
