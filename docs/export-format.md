# Export bundle format, version 1

An export bundle is the single file Cadre writes when an operator exports the member list. It
is always encrypted, and there is no plaintext export. This page is the specification: a
reader in another language (for example Phase 2's server-side importer) should be writable from
it alone, using libsodium and AES-GCM. The reasons behind the format are in
[decision record 0010](decisions/0010-export-bundle.md). The key slot and field-value formats it
reuses are defined in [decision record 0007](decisions/0007-key-derivation.md), sections 4 to 6,
and summarized here.

The reference implementation is `src/crypto/exportBundle.ts` (framing) and
`src/domain/exportPayload.ts` (payload). A committed golden bundle,
`src/crypto/fixtures/golden-v1.bundle.b64` (base64, passphrase
`golden fixture passphrase, not real`), must keep opening in every later release.

All integers are unsigned big-endian. Offsets are in bytes.

## Layout

| Offset | Length | Content                                                    |
| ------ | ------ | ---------------------------------------------------------- |
| 0      | 7      | Magic: ASCII `CADREXB` (`43 41 44 52 45 58 42`)            |
| 7      | 1      | Bundle format version: `0x01`                              |
| 8      | 2      | Slot length `n`. Must be `87` in version 1                 |
| 10     | 87     | Key slot under the export passphrase (below)               |
| 97     | 36     | Bundle ID: a random lowercase UUID, as ASCII               |
| 133    | rest   | Field value holding the payload (below), at least 61 bytes |

The smallest valid bundle is 194 bytes.

## Reading a bundle

A reader must check in this order, and stop at the first failure:

1. **Magic.** Bytes 0 to 6 must be `CADREXB`. Otherwise: "not a Cadre export bundle". This also
   rejects the unreleased interim bundles that began with `CADREi00`.
2. **Version.** Byte 7 (present in any bundle of 8 bytes or more) must be a version the reader
   knows. A higher version fails with "made by a newer version of Cadre; update to import it".
   Never report this as a wrong passphrase, and never run Argon2id for it. Version `0x00` was
   never written and is reported as a damaged header.
3. **Slot length and size.** Bytes 8 to 9 must be `87`, and the bundle must be at least
   `10 + 87 + 36 + 61 = 194` bytes. Otherwise: "damaged" or "truncated export bundle".
4. **Bundle ID.** Bytes 97 to 132 must be ASCII and match
   `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Otherwise: "damaged export
   bundle header". Because it is ASCII, the string used in the AAD is exactly these 36 bytes.
5. **Inner versions.** In a version 1 bundle, slot bytes 0 and 1 (bundle bytes 10 and 11) and
   the first byte of the field value (bundle byte 133) are always `0x01`. Any other value is
   damage: report it like a failed unlock (slot) or a failed decryption (field value), never as
   "update Cadre".
6. **Unlock the slot** with the export passphrase (next section). Failure means a wrong
   passphrase or a damaged slot. The two are deliberately indistinguishable.
7. **Decrypt the payload** with the field key and the binding below. Failure means the bundle ID
   or payload was changed or damaged.
8. **Parse the payload** strictly (see Payload).

The magic, slot length and inner version bytes have one valid value each, and the bundle ID has
a fixed shape. Every other header byte is authenticated: the slot's settings and salt by the
slot's own wrap, and the version byte and bundle ID by the payload's AAD.

## Key slot (87 bytes)

| Offset | Length | Content                                                          |
| ------ | ------ | ---------------------------------------------------------------- |
| 0      | 1      | Slot format version, `0x01`                                      |
| 1      | 1      | Slot kind, `0x01` = passphrase                                   |
| 2      | 1      | KDF algorithm, `0x02` = libsodium `crypto_pwhash_ALG_ARGON2ID13` |
| 3      | 4      | opslimit                                                         |
| 7      | 4      | memlimit, in bytes                                               |
| 11     | 16     | Salt                                                             |
| 27     | 12     | AES-GCM nonce for the wrap                                       |
| 39     | 48     | Wrapped master key: 32 bytes of ciphertext + 16-byte tag         |

To unlock:

1. Reject a slot whose version or kind is not `0x01`, or whose KDF algorithm byte is not
   `0x02`. Reject settings below opslimit 2 / memlimit 67108864 or above opslimit 4 / memlimit
   1073741824 before running Argon2id.
2. Normalize the passphrase to Unicode NFC and encode it as UTF-8. Nothing else (no trimming,
   no case folding).
3. `wrappingKey = crypto_pwhash(32, passphrase, salt, opslimit, memlimit, ARGON2ID13)`.
4. `masterKey = AES-256-GCM-decrypt(wrappingKey, nonce, wrapped, aad = slot[0..27))`, with a
   128-bit tag. Bytes 0 to 26 of the slot are the AAD.
5. `fieldKey = crypto_kdf_derive_from_key(32, 1, "fieldenc", masterKey)`.

Cadre writes new bundles at libsodium's MODERATE settings (opslimit 3, memlimit 268435456).
The master key is fresh random bytes for every bundle and is not the store's key.

## Payload field value

| Offset   | Length | Content                                  |
| -------- | ------ | ---------------------------------------- |
| 0        | 1      | Field format version, `0x01`             |
| 1        | 12     | AES-GCM nonce                            |
| 13       | 32 × k | Ciphertext of the padded payload (k ≥ 1) |
| end − 16 | 16     | GCM tag                                  |

The binding for a version 1 bundle is:

- namespace: `cadre-export-v1` (that is, `cadre-export-v` followed by the bundle version from
  byte 7 in decimal)
- recordId: the 36-character bundle ID
- field: `payload`

The AAD is:

```
0x01 ‖ u16 len ‖ namespace ‖ u16 len ‖ recordId ‖ u16 len ‖ field
```

where each `len` counts UTF-8 bytes and the leading `0x01` is the field format version. Decrypt
with AES-256-GCM, the field key, the nonce and this AAD, then remove the padding with libsodium
`sodium_unpad` (ISO/IEC 7816-4) at a block size of 32.

## Payload

UTF-8 JSON (invalid UTF-8 is rejected), one object with exactly these keys:

```json
{
  "exportedAt": "2026-11-26T00:00:00.000Z",
  "members": [
    {
      "id": "0000000a-0000-4000-8000-00000000000b",
      "displayName": "Payload Fixture",
      "email": "payload.fixture@example.invalid",
      "phone": null,
      "role": null,
      "notes": null,
      "createdAt": "2026-11-01T00:00:00.000Z",
      "updatedAt": "2026-11-02T00:00:00.000Z",
      "expiresAt": null
    }
  ]
}
```

| Key                               | Type                    | Notes                             |
| --------------------------------- | ----------------------- | --------------------------------- |
| `exportedAt`                      | timestamp               | When the export ran               |
| `members`                         | array of member objects | No two with the same `id`         |
| `id`                              | string                  | Lowercase UUID; kept on import    |
| `displayName`                     | string                  | May be empty                      |
| `email`, `phone`, `role`, `notes` | string or `null`        | Plaintext; re-encrypted on import |
| `createdAt`, `updatedAt`          | timestamp               | Kept on import                    |
| `expiresAt`                       | timestamp or `null`     | `null` means "never expires"      |

A timestamp is exactly the form JavaScript's `Date.prototype.toISOString` writes, in UTC, and
a real calendar date: `YYYY-MM-DDTHH:MM:SS.sssZ` for years 0000 to 9999, and `±YYYYYY-…` (a
sign and six digits) for years outside that range, which a store can hold.

The payload must be exactly the canonical encoding: keys in the order shown, no whitespace,
strings escaped as JavaScript's `JSON.stringify` escapes them. Cadre's reader parses the JSON,
validates it, re-encodes it and rejects the bundle if the bytes differ. That one check rejects
repeated keys (which many JSON parsers silently collapse), reordered keys and added
whitespace. A reader in another language that cannot reproduce the encoding must at least
reject repeated keys.

A reader rejects any unknown, missing or repeated key, at either level, and any value of the
wrong type. It never ignores what it does not understand. Error messages may name an expected
key, but never a value or an unknown key.

## Import rules

- Rows whose `expiresAt` is at or before the import time are skipped and counted, never
  written. The exporter also leaves out rows already expired when it runs.
- Import is replace-only. A store that already has members is refused unless the caller asks
  to replace it, in which case every existing member is deleted and the bundle written in one
  transaction.
- Every value is re-encrypted under the receiving store's keys. Nothing from the bundle's keys
  is kept.

## Writing a bundle

The export passphrase must be at least 15 Unicode code points after NFC normalization. A
writer makes a new passphrase slot (fresh master key, fresh salt), a fresh bundle ID, and one
field value with a fresh nonce for every bundle.

## Changing the format

Any change to the header or the payload's shape, including a new optional key, gets a new
bundle version. Readers keep reading every older version they ever supported.
