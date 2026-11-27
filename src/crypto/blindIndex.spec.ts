// @vitest-environment node
import { createPassphraseSlot, MIN_KDF_PARAMS } from 'keyslot'
import { describe, expect, it } from 'vitest'

import type { BlindIndexedField } from '../domain/sensitiveFields'
import { blindIndex, normalizeForBlindIndex } from './blindIndex'

const { keyRing } = await createPassphraseSlot('test passphrase, not real', {
  kdf: MIN_KDF_PARAMS,
})

// The rules from docs/decisions/0008-blind-index.md, decision 4. Changing a row here means
// changing the stored format: bump BLIND_INDEX_RULES_VERSION with it.
const TABLE: [BlindIndexedField, string, string][] = [
  // Every field: NFKC, trim, collapse whitespace.
  ['displayName', '  Ada   Lovelace  ', 'ada lovelace'],
  ['displayName', 'Ada\t\nLovelace', 'ada lovelace'],
  ['displayName', 'Ada Lovelace', 'ada lovelace'], // no-break space
  ['displayName', 'Ａｄａ', 'ada'], // full-width letters
  ['displayName', 'Amélie', 'amélie'], // combining accent composes
  ['displayName', 'ADA LOVELACE', 'ada lovelace'],
  // Lowercase, not full case folding: ß and ss stay distinct.
  ['displayName', 'Straße', 'straße'],
  ['displayName', '   ', ''],
  // Email: lowercase the whole address; dots and +tags are kept.
  ['email', ' Ada.Lovelace+Notes@Example.ORG ', 'ada.lovelace+notes@example.org'],
  ['email', 'ａｄａ@example.org', 'ada@example.org'],
  ['email', '', ''],
  // Phone: a leading + and digits only; no country-code inference.
  ['phone', '+1 (555) 010-0142', '+15550100142'],
  ['phone', '555.010.0142', '5550100142'],
  ['phone', '  +44 20 7946 0000 ', '+442079460000'],
  ['phone', '５５５０', '5550'], // full-width digits
  ['phone', '1+555', '1555'], // a + that isn't leading is dropped
  ['phone', '+', ''],
  ['phone', '+ - ()', ''],
  ['phone', 'ext.', ''],
]

describe('normalizeForBlindIndex', () => {
  it.each(TABLE)('%s %j normalizes to %j', (field, input, expected) => {
    expect(normalizeForBlindIndex(field, input)).toBe(expected)
  })
})

describe('blindIndex', () => {
  it('gives equal indexes for values that normalize the same way', async () => {
    const a = await blindIndex(keyRing, 'phone', '+1 (555) 010-0142')
    const b = await blindIndex(keyRing, 'phone', '+15550100142')
    expect(a).toHaveLength(32)
    expect(a).toEqual(b)
  })

  it('separates fields: the same value in two fields gets two indexes', async () => {
    const asName = await blindIndex(keyRing, 'displayName', 'ada@example.org')
    const asEmail = await blindIndex(keyRing, 'email', 'ada@example.org')
    expect(asName).not.toEqual(asEmail)
  })

  it('does not match a prefix, substring or near miss', async () => {
    const full = await blindIndex(keyRing, 'displayName', 'Ada Lovelace')
    for (const partial of ['Ada', 'Lovelace', 'Ada Lovelac', 'da Lovelace', 'Ada  Lovelace x']) {
      expect(await blindIndex(keyRing, 'displayName', partial)).not.toEqual(full)
    }
  })

  it('gives no index for a value that normalizes to empty', async () => {
    expect(await blindIndex(keyRing, 'phone', ' + ')).toBeNull()
    expect(await blindIndex(keyRing, 'email', '  ')).toBeNull()
  })

  it('depends on the key, not only the value', async () => {
    const other = await createPassphraseSlot('another test passphrase', { kdf: MIN_KDF_PARAMS })
    expect(await blindIndex(other.keyRing, 'email', 'ada@example.org')).not.toEqual(
      await blindIndex(keyRing, 'email', 'ada@example.org'),
    )
  })
})
