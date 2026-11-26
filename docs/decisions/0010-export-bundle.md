# 0010 — Encrypted export bundle

**Status:** proposed
**Date:** 2026-11-26
**Issue:** #14. Builds on 0007 (key derivation). Consumed by Phase 2's server-side importer.

An export bundle is a single file that moves a member list between browsers, serves as a
backup, and is what Phase 2 imports onto a server. It is built only from the `keyslot`
package accepted in 0007: a fresh passphrase key slot under the **export** passphrase wraps a
fresh random key, and the member rows, with their sensitive fields in plaintext, are one
AES-256-GCM value under that key. A bundle left in `Downloads` or a leaked backup is the A1
path, so the bundle gets the same Argon2id protection as the store itself. Row names (A1, R5,
R6) refer to [the threat model](../threat-model.md).

## Decisions

### 1. Compose `keyslot`, not `age`

The bundle reuses 0007's key slot as its header, as 0007 decision 11 anticipated. The slot
already carries the Argon2id salt and settings the issue asks for, authenticates them, and
gives a wrong passphrase and a damaged header one indistinguishable `UnlockError`.

`age` (passphrase mode, via the `age-encryption` JavaScript package) was the alternative. Its
real advantage is that an org could decrypt a bundle with the standard `age` command-line tool
if Cadre ever disappeared. It was not chosen because:

- age's passphrase mode uses scrypt, not Argon2id. Cadre would ship and test a second
  password KDF with its own work-factor rules, which is the "two key-derivation paths" problem
  0007 decision 3 rejected for PBKDF2 (R6).
- Its keys live as plain bytes in JavaScript memory. `keyslot` keeps the bundle key as a
  non-extractable WebCrypto key, as for the store (0007 decision 7).
- It adds a crypto dependency for a format Cadre can document fully in one page. The
  "readable without Cadre" property is kept by writing `docs/export-format.md` precisely
  enough to implement from (the issue's bar for Phase 2), using only libsodium and AES-GCM.

### 2. Plaintext rows inside the envelope, under a fresh key

The payload holds decrypted rows, not the store's field ciphertexts plus a copy of its key.

- **Phase 2 needs it.** The server re-encrypts every field under envelope keys held in
  OpenBao (0007 decision 11a). Store ciphertexts are bound by AAD to the store's master key
  and would have to be decrypted anyway, which would mean shipping that master key.
- **The bundle must not carry the store's master key.** A bundle that did would let its
  holder read every later copy of the store, which is the A6 problem 0007 solved by making
  "change passphrase" rotate. Each bundle gets its own random key, so a bundle reveals the
  rows it contains and nothing more.
- **Plaintext exists only inside one authenticated encryption.** It is never written
  unencrypted, logged or cached (AGENTS.md rule 2), and there is no plaintext export at all.

### 3. A separate export passphrase

The export passphrase is supplied at export time and is not the store passphrase.

- A bundle is meant to travel: to another device, to a backup drive, to whoever runs the
  Phase 2 server. Using the store passphrase would hand that person the key to the browser
  store too, and the store passphrase to whoever later finds the bundle.
- Changing the store passphrase cannot reach a bundle already written (R5). Decoupling makes
  that obvious instead of implying the bundle "rotates" with the store.
- The same 15-character minimum as the store (0007 owner decision 2) applies. 0007 put that
  check in the UI (#15). **Proposed, pending owner question 2:** the repository also rejects a
  shorter export passphrase, so the rule holds for any caller, not just the UI.

### 4. Wire format, version 1

| Offset | Length | Content                                                                  |
| ------ | ------ | ------------------------------------------------------------------------ |
| 0      | 7      | Magic, ASCII `CADREXB`                                                   |
| 7      | 1      | Bundle format version, `0x01`                                            |
| 8      | 2      | Slot length `n`, unsigned big-endian (87 for a v1 passphrase slot)       |
| 10     | n      | `keyslot` passphrase slot (0007 decision 6), under the export passphrase |
| 10 + n | 36     | Bundle ID, a random lowercase UUID in ASCII                              |
| 46 + n | rest   | `keyslot` field value (0007 decision 6) holding the UTF-8 JSON payload   |

The payload is encrypted with the slot's field key and the binding
`{ namespace: "cadre-export-v" + <bundle version, decimal>, recordId: <bundle ID>, field: "payload" }`,
so `cadre-export-v1` for version 1. (The leading `0x01` of 0007's AAD is the field format
version, not this bundle version.) A v1 reader works in this order, and every header byte ends
up checked:

1. Check the magic. Any other value is a format error.
2. Read the version byte. An unknown version is rejected with `UnsupportedFormatError` before
   anything is decrypted.
3. Check the slot length. Version 1 requires exactly 87, and the bundle must be long enough to
   hold the slot, the bundle ID and a minimum-size field value (61 bytes). Anything else is a
   format error.
4. Unlock the slot. The slot's own wrap authenticates its settings and salt.
5. Decrypt the payload, building the namespace from the version byte read in step 2. A version
   byte changed to another known version, or a changed bundle ID or payload, fails decryption.

The magic and the slot length have exactly one valid value in version 1, and everything else is
authenticated by the slot or by the payload's AAD.

The payload is one JSON object:

```json
{
  "exportedAt": "2026-11-26T21:00:00.000Z",
  "members": [
    {
      "id": "…uuid…",
      "displayName": "…",
      "email": null,
      "phone": null,
      "role": null,
      "notes": null,
      "createdAt": "…ISO 8601 UTC…",
      "updatedAt": "…",
      "expiresAt": null
    }
  ]
}
```

Member IDs and timestamps are kept, so an import restores the same records and retention
dates. Unknown keys are rejected rather than ignored, so a reader never silently drops data a
newer writer added. Any change to the header or the payload's shape gets a new version.

**Version rules.** A reader accepts only versions it knows. A newer version fails with
`UnsupportedFormatError` and a message telling the operator to update Cadre, never with
"wrong passphrase" (same reasoning as 0007 owner decision 4). The interim `CADREi00` bundles
from #10 were never released, so v1 readers reject them as "not a Cadre export bundle" rather
than reading them.

### 5. Import is replace-only, and nothing expired comes back

- `importEncrypted` refuses a store that has members unless called with `replace: true`, in
  which case existing members are deleted and the bundle written in one transaction, with the
  same space reclaim as delete. Merge is not offered, because "which copy wins" has no safe
  default for a roster.
- Rows past their `expiresAt` are left out of an export and skipped on import. Otherwise an
  old bundle would bring back records the retention policy already destroyed (AGENTS.md rule
  2). The import result reports how many were skipped.
- Every imported row is re-encrypted under the receiving store's keys with fresh nonces.

## Consequences

- A bundle cannot be crypto-shredded. Once written it is outside Cadre's reach (R5), and
  deleting a member later does not remove them from bundles already made. The export UI
  (#15) must say so.
- Each export and each import costs one Argon2id run, about half a second at MODERATE.
- `ExportOptions`/`ImportOptions` gain no new fields beyond `replace` on import.
  `ImportResult` gains `skippedExpired`.
- Adding org settings (for example #13's retention default) to bundles needs format version 2.
- `docs/export-format.md` restates section 4 with byte-level examples and the error table, and
  is written with the implementation, not with this record.

## Tests the implementation must have

1. Contract: export then import into a fresh repository round-trips every field, ID and
   timestamp, on PGlite.
2. A wrong passphrase throws `UnlockError`; a flipped byte in the slot does the same.
3. A bumped version byte throws `UnsupportedFormatError` with an "update Cadre" message.
4. Bad magic, a truncated bundle, and an interim `CADREi00` bundle throw a format error.
5. A flipped byte in the bundle ID or payload throws `DecryptError`.
6. Import into a non-empty store is refused; with `replace: true` it replaces.
7. Expired rows are not exported and are skipped on import.
8. A committed golden v1 bundle, made with a known test passphrase, still imports.
9. If owner question 2 is answered yes, an export passphrase under 15 characters is rejected.
10. A slot length other than 87, or one that overruns the bundle, throws a format error.

## Questions for the owner

1. Is `keyslot` over `age` right, given that it trades away "decrypt with a stock tool" for
   one KDF and non-extractable keys?
2. Should the repository enforce the 15-character minimum on export passphrases, or leave it
   to the UI?
3. Is dropping expired rows on export and import the right call, rather than importing them
   and letting the next purge remove them?
