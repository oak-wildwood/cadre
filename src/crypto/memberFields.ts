/**
 * Cadre-specific glue between `Member` and the `keyslot` package: turns sensitive fields into
 * bytes, picks each value's `FieldBinding`, and back (record 0007, decision 10). The
 * repository adapter calls this; it never sees the passphrase.
 */
import type { FieldBinding, KeyRing } from 'keyslot'

import type { Member, MemberId } from '../domain/member'
import { SENSITIVE_FIELD_NAMES, type SensitiveField } from '../domain/sensitiveFields'

/** The AAD namespace for member rows. Part of every value's binding; don't rename. */
export const MEMBERS_NAMESPACE = 'members'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type SensitiveValues = Pick<Member, SensitiveField>
export type EncryptedValues = Record<SensitiveField, Uint8Array | null>

/**
 * A member's id, made in the browser before encrypting, because the id is part of the AAD.
 * Rows must never rely on a database default for it.
 */
export function newMemberId(): MemberId {
  return crypto.randomUUID()
}

export function memberBinding(id: MemberId, field: SensitiveField): FieldBinding {
  const recordId = id.toLowerCase()
  if (!UUID.test(recordId)) {
    throw new TypeError('Member id must be a UUID')
  }
  return { namespace: MEMBERS_NAMESPACE, recordId, field }
}

/** Encrypts one sensitive field. `null` stays `null`. */
export async function encryptMemberField(
  keyRing: KeyRing,
  id: MemberId,
  field: SensitiveField,
  value: string | null,
): Promise<Uint8Array | null> {
  return value === null
    ? null
    : keyRing.encryptField(new TextEncoder().encode(value), memberBinding(id, field))
}

/** Encrypts every sensitive field. `null` stays `null`: an empty optional field is visible. */
export async function encryptMemberFields(
  keyRing: KeyRing,
  id: MemberId,
  values: SensitiveValues,
): Promise<EncryptedValues> {
  const out = {} as EncryptedValues
  for (const field of SENSITIVE_FIELD_NAMES) {
    out[field] = await encryptMemberField(keyRing, id, field, values[field])
  }
  return out
}

export async function decryptMemberFields(
  keyRing: KeyRing,
  id: MemberId,
  encrypted: EncryptedValues,
): Promise<SensitiveValues> {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const out = {} as Record<SensitiveField, string | null>
  for (const field of SENSITIVE_FIELD_NAMES) {
    const value = encrypted[field]
    out[field] =
      value === null
        ? null
        : decoder.decode(await keyRing.decryptField(value, memberBinding(id, field)))
  }
  if (out.displayName === null) {
    throw new TypeError('displayName is required')
  }
  return out as SensitiveValues
}
