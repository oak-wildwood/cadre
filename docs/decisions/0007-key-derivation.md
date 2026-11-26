# 0007 — Key derivation and field encryption

**Status:** proposed
**Date:** 2026-11-25
**Issue:** #11. Depended on by #12 (blind index), #14 (export bundle) and #15 (UI).

This record decides how Cadre turns a passphrase into keys, and how it encrypts each sensitive
field. It is longer than most records because every later security feature builds on it. Row
names such as A1, R3 and Q4 refer to [the threat model](../threat-model.md).

## Summary

1. The passphrase is the only way in. Nothing that can unlock the data is stored. A forgotten
   passphrase means the data is gone, on purpose.
2. The passphrase is stretched with Argon2id (libsodium `crypto_pwhash`) at libsodium's
   "moderate" setting: 3 passes over 256 MiB. The salt and settings are saved with each store.
3. If libsodium cannot load, Cadre refuses to unlock. There is no PBKDF2 fallback.
4. The passphrase does not encrypt the data directly. It unwraps a random **master key**. Two
   separate keys are derived from the master key: one for encryption, one for blind indexes.
5. Each value is encrypted with AES-256-GCM (WebCrypto) and a fresh random nonce. The value is
   tied to its record and its field, and padded so its length gives less away.
6. Every encrypted value and every key slot starts with a version byte.
7. Keys live in memory only, as non-extractable WebCrypto keys, inside a `KeyRing` that the
   repository receives by injection.
8. No hash of the passphrase is stored. A wrong passphrase and a damaged store produce the
   same error.
9. `role` and `notes` are encrypted and have no blind index. Name, email and phone are
   encrypted and blind-indexed.
10. The crypto code is a standalone package with no knowledge of members or of Cadre.
11. The design leaves room for a recovery key, server-held keys and sharing. None is built now.
12. A list of required tests is at the end.

## Terms

- **Key slot:** a small record that stores the master key in wrapped (encrypted) form, plus
  what is needed to unwrap it. One slot today. More slots can wrap the same master key later.
- **Wrapping key:** the key Argon2id produces from the passphrase. It only ever unwraps the
  master key.
- **Master key:** 32 random bytes, made once when the store is created.
- **Subkey:** a key derived from the master key for one job.
- **AAD (additional authenticated data):** data that is not encrypted but is checked on
  decryption. If it differs, decryption fails.

```
passphrase ──Argon2id(salt, params)──▶ wrapping key
                                            │ AES-256-GCM unwrap (key slot)
                                            ▼
                                       master key (random)
                         ┌──────────────────┴──────────────────┐
        crypto_kdf_derive_from_key                 crypto_kdf_derive_from_key
          id 1, context "fieldenc"                   id 2, context "blindidx"
                         ▼                                      ▼
            field key (AES-256-GCM)               blind-index key (HMAC-SHA-256)
```

## Decisions

### 1. The key comes from a passphrase. Nothing that unlocks the data is stored.

A stored key would sit on the same disk as the data, so a stolen laptop (A1) or a seized device
(A4) would yield both. A passphrase-derived key exists only while the operator is using Cadre.

**A forgotten passphrase means the data is gone. This is intended.** If Cadre could recover the
data, so could anyone who can compel or impersonate the party doing the recovering (A2, A4).
There is no reset, no back door and no support path. The UI (#15) must say this plainly when
the store is created.

The passphrase is normalized to Unicode NFC before use, so the same passphrase typed on
different keyboards gives the same key. NIST SP 800-63B-4 section 3.1.1.2 recommends NFC.
Nothing else is changed: no trimming, no case folding.

### 2. Argon2id at the "moderate" setting, recorded per store

Argon2id makes each passphrase guess slow and memory-hungry. That is the main defense once
someone has a copy of the store (A1, R6). The call is libsodium's `crypto_pwhash` with
`crypto_pwhash_ALG_ARGON2ID13`.

| Parameter         | libsodium constant                | Value                       |
| ----------------- | --------------------------------- | --------------------------- |
| Algorithm         | `crypto_pwhash_ALG_ARGON2ID13`    | `2`                         |
| Passes (opslimit) | `crypto_pwhash_OPSLIMIT_MODERATE` | `3`                         |
| Memory (memlimit) | `crypto_pwhash_MEMLIMIT_MODERATE` | `268435456` bytes (256 MiB) |
| Salt length       | `crypto_pwhash_SALTBYTES`         | `16` bytes, random per slot |
| Output length     | n/a                               | `32` bytes                  |
| Parallelism       | none; libsodium always uses 1     | `1`                         |

These values were read from `libsodium-wrappers-sumo` 0.8.4 (libsodium 1.0.22) while writing
this record.

**Why moderate.** The operator unlocks once per session, so about a second of waiting is
acceptable. libsodium's guide allows up to 5 seconds for a password that is not typed often.
"Interactive" (2 passes, 64 MiB) is several times cheaper for an attacker to guess against
(it ran about five times faster in the same measurement below).
"Sensitive" (4 passes, 1 GiB) will not fit in memory on many phones. For comparison, RFC 9106's
second recommended option is 3 passes over 64 MiB, and OWASP's minimum for server logins is 2
passes over 19 MiB. Moderate is above both. Cadre's members face worse outcomes than a typical
login leak, and the wait is paid once per session.

**Cost.** Measured for this record: about 0.6 seconds in Node 24 on a recent laptop. libsodium
documents about 0.7 seconds natively on a 2.8 GHz Core i7. In a browser the work runs in
WebAssembly, on one thread, and needs 256 MiB of free memory for that moment.
`UNVERIFIED`: timing and memory behavior in real browsers, and on low-end phones, has not been
measured. This must be measured before this record is accepted (see open questions). If a
device cannot allocate the memory, unlock fails with a "this device cannot run the encryption"
error. It does not fall back to weaker settings. The work should run in a Web Worker so the
page does not freeze.

**Where the salt and settings live.** In the key slot (see decision 6), which Cadre stores in
a new `key_slots` table. Each slot carries its own algorithm, passes, memory and salt. Unlock
always uses the values in the slot, never the constants in the code. So the defaults can be
raised in a later release without breaking old stores. After a successful unlock, if a slot is
below the current defaults, Cadre re-wraps the master key at the current defaults. That is one
small write, with no field re-encryption.

**Limits on stored settings.** Before running Argon2id, the code rejects a slot whose settings
are below the "interactive" values (2 passes, `67108864` bytes) or above the "sensitive" values
(4 passes, `1073741824` bytes). The floor stops a silently weak store. The ceiling stops a
tampered store from freezing or crashing the device.

**Library build.** `crypto_pwhash` is only in the `libsodium-wrappers-sumo` package, not in
plain `libsodium-wrappers` as issue #11 says. Cadre uses the sumo build. It is larger (about
1.2 MB before compression).

### 3. No PBKDF2 fallback. If libsodium fails to load, fail closed.

This answers Q4. If libsodium does not load, Cadre shows an error and refuses to create or
unlock a store.

- PBKDF2 is not memory-hard. Guessing against it is far cheaper on graphics cards, so a store
  made on a "bad load" day would be permanently weaker without the operator knowing (R6).
- A fallback is a downgrade path. Anyone who can make the libsodium file fail to load, such as
  a tampered deployment (A8), could push new stores onto the weaker path.
- Two key-derivation paths mean twice the code to test in the one place that must not be wrong.

The same rule applies to WebCrypto. `crypto.subtle` exists only in secure contexts (HTTPS or
localhost). Without it, Cadre refuses to run. Self-hosters must serve Cadre over HTTPS, and a
Content-Security-Policy must include `'wasm-unsafe-eval'` in `script-src` or the browser blocks
libsodium's WebAssembly.

### 4. A random master key, wrapped by the passphrase key, with two subkeys

**The passphrase key wraps the master key. It is not the master key.** This goes beyond issue
#11, which derives subkeys straight from the passphrase key. The reasons:

- Raising the Argon2id settings, adding a recovery key, or moving key custody to a server
  (decision 11) only rewrites the small key slot. No field is re-encrypted.
- The slot's authentication tag doubles as the passphrase check (decision 8).
- The master key is fully random, so the subkeys never depend on passphrase quality directly.

The master key is 32 bytes from libsodium `crypto_kdf_keygen`. It is wrapped with AES-256-GCM
under the wrapping key, with a random 96-bit nonce, and with the slot header as AAD.

**Subkeys.** Both come from libsodium `crypto_kdf_derive_from_key(32, id, context, masterKey)`.
The context must be exactly 8 characters (`crypto_kdf_CONTEXTBYTES` = 8; master key length
`crypto_kdf_KEYBYTES` = 32).

| Subkey          | Subkey ID | Context    | Used for                               |
| --------------- | --------- | ---------- | -------------------------------------- |
| Field key       | `1`       | `fieldenc` | AES-256-GCM encryption of field values |
| Blind-index key | `2`       | `blindidx` | HMAC-SHA-256 for blind indexes (#12)   |

One key is never used for two jobs. libsodium documents that knowing one subkey reveals neither
the master key nor the other subkey. If the blind-index key leaked, the encrypted values would
still be safe. New IDs and contexts are added for new purposes. Existing ones are never reused
or renumbered.

**Changing the passphrase.** There are two different operations, and the difference matters:

- **Re-wrap:** derive a new wrapping key and re-wrap the same master key. Instant. It protects
  against someone who knows the old passphrase but has no copy of the store.
- **Rotate:** create a new master key, re-encrypt every field and recompute every blind index
  in one transaction. Slower, but still quick at Cadre's size.

Re-wrapping does **not** lock out a former admin who kept a copy of the old store (A6). They
can unwrap the old slot with the old passphrase, get the master key, and read any newer copy
they obtain. So in Phase 1, the "Change passphrase" action in Settings (#15) always **rotates**.
Re-wrap alone is used only for raising Argon2id settings and, later, for adding slots. Neither
operation can pull back data that was already copied (R5).

### 5. Field encryption: AES-256-GCM, bound to the record and the field, padded

Each sensitive value is encrypted on its own with WebCrypto `AES-GCM`, a 256-bit key, a 128-bit
tag and a fresh 96-bit nonce from `crypto.getRandomValues`. This keeps issue #11's choice.

**Why AES-GCM and not XChaCha20-Poly1305 or secretbox.** WebCrypto can hold an AES key as a
non-extractable `CryptoKey`, so page scripts can use the key but cannot read its bytes
(decision 7). A libsodium key would have to sit in ordinary JavaScript memory as plain bytes
for the whole session, which makes R3 and A4 worse. libsodium's XChaCha20-Poly1305 has a longer
nonce (192 bits), which only matters at volumes Cadre will never reach (next paragraph).
`crypto_secretbox` has no AAD, so it cannot bind a value to its field.

**Nonce collisions.** Reusing a nonce with the same key breaks AES-GCM, so the question is how
likely two random 96-bit nonces are to match. NIST SP 800-38D requires that chance to stay
below 2^-32, and for random nonces caps one key at 2^32 (about 4.3 billion) encryptions. Cadre
is far below this. 500 members, 5 encrypted fields each, every field saved 1,000 times is 2.5
million encryptions. The chance of any collision is then about 4 in 10^17 (2^-54). Rotation
(decision 4) also resets the count.

**Binding (AAD).** The AAD names the table, the record and the field, so a ciphertext only
decrypts in the place it was written for. This goes beyond issue #11, which binds the field
name only. Without the record ID, someone with write access to the database (A3) could copy one
member's encrypted email into another member's row and it would decrypt cleanly.

```
AAD = 0x01 ‖ len(namespace) ‖ namespace ‖ len(recordId) ‖ recordId ‖ len(field) ‖ field
```

Each `len` is 2 bytes, big-endian, counting UTF-8 bytes. The length prefixes make the encoding
unambiguous. In Cadre, `namespace` is `members`, `recordId` is the member's UUID in lowercase,
and `field` is the name from `sensitiveFields.ts` (for example `displayName`).

What binding does not stop: an attacker with write access can still delete rows, blank an
optional field, change plaintext columns such as `expires_at`, or put back an **older**
ciphertext of the same field on the same record. Detecting that needs the Phase 2 audit log.

**Padding.** AES-GCM hides content but not length. Unpadded, the ciphertext of `organizer` is
longer than that of `member`, which would undo the point of encrypting `role` (Q1). So each
value is padded to a multiple of 32 bytes with libsodium `pad` (ISO/IEC 7816-4) before
encryption and unpadded with `unpad` after decryption. This goes beyond issue #11. Values under
32 bytes all look the same size. Longer values, such as notes, still reveal their length to the
nearest 32 bytes, and an empty optional field is still visibly empty (`NULL`). Both are added
to R1.

### 6. Wire formats, both versioned

**Encrypted field value** (stored as `bytea`, handled as `Uint8Array`):

| Offset   | Length | Content                                            |
| -------- | ------ | -------------------------------------------------- |
| 0        | 1      | Format version. `0x01` = everything in decision 5. |
| 1        | 12     | Nonce                                              |
| 13       | 32 × n | Ciphertext of the padded value (n ≥ 1)             |
| end − 16 | 16     | GCM authentication tag                             |

WebCrypto returns the ciphertext with the tag already appended, so the stored value is
`version ‖ nonce ‖ encrypt-output`. (MDN does not spell out the tag position. It was confirmed
by running WebCrypto in Node 24: the output is the input length plus 16 bytes.) The smallest
valid value is 61 bytes. The version byte is
also the first byte of the AAD, so it cannot be changed without failing decryption. An unknown
version is rejected. A future algorithm gets a new version number, and old values stay readable
until they are re-saved.

**Key slot** (87 bytes for a passphrase slot):

| Offset | Length | Content                                                |
| ------ | ------ | ------------------------------------------------------ |
| 0      | 1      | Slot format version, `0x01`                            |
| 1      | 1      | Slot kind, `0x01` = passphrase                         |
| 2      | 1      | KDF algorithm, `0x02` = `crypto_pwhash_ALG_ARGON2ID13` |
| 3      | 4      | opslimit, unsigned big-endian                          |
| 7      | 4      | memlimit in bytes, unsigned big-endian                 |
| 11     | 16     | Salt                                                   |
| 27     | 12     | Nonce for the wrap                                     |
| 39     | 48     | Wrapped master key (32 bytes + 16-byte tag)            |

Bytes 0 to 26 are the AAD of the wrap, so the settings and salt cannot be edited without
failing unlock.

### 7. KeyRing lifecycle

- `unlock(passphrase, slot)` returns a `KeyRing`. It holds exactly two things: the field key
  and the blind-index key, both imported into WebCrypto with `extractable: false`. The field
  key allows only `encrypt` and `decrypt`. The blind-index key is an HMAC-SHA-256 key that
  allows only `sign`.
- The passphrase bytes, the wrapping key, the master key and the raw subkey bytes are
  overwritten with libsodium `memzero` as soon as the import finishes. The `KeyRing` does not
  keep the master key. Rotating or re-wrapping asks for the passphrase again.
- `lock()` drops both keys. Every later call on that `KeyRing` throws a `LockedError`.
- The repository receives the `KeyRing` through its constructor. It never sees the passphrase.
  Nothing from the `KeyRing` is written to `localStorage`, IndexedDB, logs or error reports.

**What this does and does not protect (R3).** Be clear about the limits:

- Non-extractable means `exportKey` and `wrapKey` refuse to hand over the key bytes. A
  malicious script cannot copy the key and take it away.
- It does **not** stop a malicious script in the page from _using_ the key while Cadre is
  unlocked, or from reading names already on screen. A tampered deployment (A8, R2) can still
  capture the passphrase as it is typed.
- JavaScript cannot guarantee memory is wiped. The passphrase arrives as a string, which cannot
  be overwritten. `memzero` is best effort, because the engine may have made copies. The
  browser keeps the real key bytes somewhere in its own memory until it frees them.
- So `lock()` shrinks the window. It is not proof against someone with memory access to an
  unlocked or recently locked device (A4). Closing the tab or powering off is stronger.

### 8. Passphrase check without a stored hash

No hash of the passphrase and no separate check value is stored. The key slot is the check.
AES-GCM only unwraps the master key if the wrapping key is right and the slot is unmodified. If
the unwrap succeeds, the passphrase was correct.

A wrong passphrase, a damaged slot and a tampered slot all fail the same way, with the same
`UnlockError` and the same message (#15). The error carries no detail that tells them apart.
Field decryption failures likewise throw one `DecryptError` with no cause attached, and no
error message ever contains plaintext or key material.

Two failures are reported differently, because neither says anything about the passphrase and
both need a different action from the operator:

- `CryptoUnavailableError`: libsodium or WebCrypto is missing, or the device cannot allocate
  the Argon2id memory.
- `UnsupportedFormatError`: the slot's version or kind is newer than this build understands.
  Telling the operator to update is better than letting them believe they forgot the passphrase.

### 9. Sensitive fields

The list in `src/domain/sensitiveFields.ts` becomes:

| Field         | Encrypted | Blind-indexed |
| ------------- | --------- | ------------- |
| `displayName` | yes       | yes           |
| `email`       | yes       | yes           |
| `phone`       | yes       | yes           |
| `role`        | yes       | **no**        |
| `notes`       | yes       | **no**        |

- **`role` is sensitive (Q1).** A role such as "organizer" marks who to target first (A2, A4).
  The role is decrypted with the rest of the member and filtered in the browser.
- **`role` gets no blind index.** A blind index shows which rows share a value (R1). Roles have
  few distinct values, so the index would sort members into groups, and the small group is the
  organizers. That would hand back most of what encrypting `role` protects. At a few hundred
  members, filtering after decryption is fast.
- **`notes` gets no blind index (Q2).** Exact-match search on free text is rarely useful, and
  the index would reveal which members have identical notes.

`findByBlindIndex` should accept only the three indexed fields. That is a type narrowing, not a
behavior change, and the contract tests already use only `displayName`.

**This needs migration `0002`.** It is out of scope here and belongs to the implementation of
#11. It must:

- drop the `members_notes_bidx_idx` index and the `notes_bidx` column;
- replace the plaintext `role` column with `role_enc bytea`, with no `role_bidx`;
- add a `key_slots` table that holds key slot blobs.

No released version has written data yet, so there are no real `role` values to carry over.
Because the record ID is part of the AAD, the adapter must generate the member's UUID in the
browser (`crypto.randomUUID()`) before encrypting, instead of relying on the column default.

### 10. A standalone package

The crypto code lives in its own workspace package, `packages/keyslot/`, published as
`keyslot` and licensed Apache-2.0 (owner decision 5). It depends only on `libsodium-wrappers-sumo` and the platform's WebCrypto.
It imports nothing from `src/`, knows nothing about members, tables or storage engines, and
does no I/O. Other applications can use it unchanged.

**Inside the package (public API):**

| Name                                                                                             | Kind          | Purpose                                                                |
| ------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------- |
| `ready()`                                                                                        | function      | Loads libsodium and checks WebCrypto. Throws `CryptoUnavailableError`. |
| `createPassphraseSlot(passphrase, options?)`                                                     | function      | New master key and slot. Returns `{ slot, keyRing }`.                  |
| `unlock(passphrase, slot)`                                                                       | function      | Returns a `KeyRing`, or throws `UnlockError`.                          |
| `rewrapPassphraseSlot(passphrase, slot, newPassphrase, options?)`                                | function      | Same master key, new slot.                                             |
| `readSlotParams(slot)`                                                                           | function      | Returns the `KdfParams` in a slot, to detect old settings.             |
| `DEFAULT_KDF_PARAMS`, `MIN_KDF_PARAMS`, `MAX_KDF_PARAMS`                                         | constants     | The values in decision 2.                                              |
| `KeyRing`                                                                                        | interface     | `encryptField`, `decryptField`, `blindIndexKey`, `lock()`, `locked`.   |
| `FieldBinding`                                                                                   | type          | `{ namespace: string; recordId: string; field: string }`               |
| `KdfParams`                                                                                      | type          | `{ algorithm: number; opslimit: number; memlimit: number }`            |
| `UnlockError`, `DecryptError`, `LockedError`, `CryptoUnavailableError`, `UnsupportedFormatError` | error classes | See decision 8.                                                        |

`keyRing.encryptField(plaintext: Uint8Array, binding: FieldBinding): Promise<Uint8Array>` and
`keyRing.decryptField(value: Uint8Array, binding: FieldBinding): Promise<Uint8Array>` work on
bytes. `keyRing.blindIndexKey` is the HMAC `CryptoKey` that #12 will use.

**Stays in Cadre:** `sensitiveFields.ts`; turning `Member` fields into bytes and back; choosing
the `FieldBinding` values; the `key_slots` table and migrations; the repository adapter; the
rotate operation (it has to walk the rows); normalization rules for blind indexes (#12); the
export bundle (#14); all UI.

`src/crypto/` remains the place for Cadre-specific glue around this package.

### 11. Forward compatibility (direction only; nothing here is built now)

The slot design in decision 4 is what makes these possible later without touching field
ciphertexts. Each needs its own decision record.

- **(a) Envelope encryption with a server-held key (Phase 2, A3).** A new slot kind holds the
  master key wrapped by a key-encryption key in OpenBao transit instead of by a passphrase.
  Crypto-shredding one member needs a random data key per record, which is then destroyed. A
  derived subkey cannot do this, because it can always be derived again. Per-record data keys
  would arrive as a new field-format version, which the version byte allows.
- **(b) Sharing with another user.** A new slot kind holds the master key (or a data key)
  sealed to the other user's public key, for example with libsodium `crypto_box_seal`.
- **(c) A printable recovery key.** A new slot kind holds the master key wrapped by a random
  256-bit key that is shown once and printed. This weakens "forgotten means gone" and creates a
  piece of paper that can be seized (A2, A4). It must be opt-in.

The export bundle (#14) can reuse the key slot format for its header. That is #14's decision.

### 12. Tests the implementation must have

From issue #11:

1. Encrypt then decrypt returns the original value, including empty strings, long notes and
   non-ASCII text.
2. A ciphertext with any one byte changed fails to decrypt (version, nonce, body and tag each).
3. A wrong field name in the binding fails.
4. A wrong passphrase fails to unlock.
5. The same plaintext encrypted twice gives different ciphertexts.
6. The Argon2id defaults equal `{ algorithm: 2, opslimit: 3, memlimit: 268435456 }` as literal
   numbers, and equal libsodium's `MODERATE` constants, so they cannot drift silently.

Added by this record:

7. A wrong record ID or a wrong namespace in the binding fails (the row-swap case).
8. An unknown field-format version is rejected. A truncated value is rejected.
9. `member` and `organizer` produce ciphertexts of the same length. A 32-byte value produces a
   longer one.
10. The two subkeys differ, and derivation matches a fixed known-answer vector.
11. A committed "golden" slot and ciphertext, made with a known test passphrase, still unlock
    and decrypt. This catches accidental format changes.
12. `crypto.subtle.exportKey` rejects for both `KeyRing` keys.
13. After `lock()`, encrypt, decrypt and `blindIndexKey` all throw `LockedError`.
14. A wrong passphrase, a flipped byte in each slot region, and a truncated slot all throw
    `UnlockError` with identical class and message.
15. Slot settings below the floor or above the ceiling are rejected, and `crypto_pwhash` is not
    called (checked with a spy).
16. A slot stores its own settings: a slot made with non-default settings unlocks after the
    defaults change, and `readSlotParams` reports the stored values.
17. When libsodium fails to load, `ready()` throws `CryptoUnavailableError`, and no PBKDF2 call
    is made.
18. Passphrases that differ only in Unicode composition (NFC against NFD) unlock the same slot.
19. Re-wrap: the old passphrase fails, the new one works, and existing ciphertexts still
    decrypt unchanged.
20. Rotate: values written after rotation cannot be decrypted with keys from the old slot and
    old passphrase, and every blind index has changed.
21. Two new slots have different salts, nonces and master keys.
22. Error messages from failed unlock and decrypt contain neither the passphrase nor plaintext.
23. The package imports nothing from `src/` (a lint rule or a dependency check).
24. `sensitiveFields.ts` matches the table in decision 9 exactly. Every listed field has a
    `_enc` column, only indexed fields have a `_bidx` column, and no plaintext `role` exists.
25. A raw dump of the PGlite store, after writing known fixture members, contains none of the
    fixture names, emails, phones, roles or notes. This automates #11's manual DevTools check.

## Alternatives considered

- **Use the passphrase-derived key directly as the master key** (issue #11 as written). Fewer
  moving parts, but every settings upgrade, recovery key or custody change would re-encrypt the
  whole store, and a separate passphrase check value would be needed.
- **A stored key, protected by the OS or browser.** Rejected: it ties safety to the device lock
  screen, which A4 assumes is defeated.
- **PBKDF2 fallback.** Rejected by the owner; see decision 3.
- **Interactive Argon2id settings (2 passes, 64 MiB).** Kinder to low-end phones, several
  times cheaper to attack. This is the fallback choice if device measurements rule out moderate.
- **XChaCha20-Poly1305 or `crypto_secretbox`.** Rejected; see decision 5.
- **Deriving subkeys with WebCrypto HKDF** so the master key never enters JavaScript memory.
  Not chosen: the wrapping key already leaves libsodium as bytes, so the exposure is the same,
  and issue #11 names `crypto_kdf_derive_from_key`.
- **A blind index on `role`.** Rejected; see decision 9.
- **No padding.** Rejected; it leaks short values such as roles through their length.

## Consequences

- **The threat model needs edits once PR #51 merges** (the link at the top is broken until
  then). Q1, Q2 and Q4 are answered here. A6 says change-passphrase "re-encrypts the store";
  that is true only because Cadre's action rotates (decision 4). R1 should add that value
  lengths, rounded up to 32 bytes, and empty optional fields are visible. A1's text should
  mention the wrapped master key.
- **Issue #11's text is out of date** on four points: the sumo package, the wrapped master
  key, the record ID in the AAD, and padding. The PBKDF2 line is removed.
- **#12 is constrained:** the blind-index key is a non-extractable WebCrypto HMAC key, so blind
  indexes use WebCrypto `HMAC`, not libsodium `crypto_auth`. Only three fields are indexed.
- **#15 is constrained:** role filtering happens in the browser; "Change passphrase" rotates
  and asks for the current passphrase; the store-creation screen must state that a forgotten
  passphrase cannot be recovered.
- **Renaming a sensitive field, a table or a record ID breaks decryption** of existing values,
  because those names are in the AAD. A rename needs a re-encrypting migration.
- **Rotation leaves old row versions on disk** until Postgres reclaims the space. That is Q3,
  owned by #10 and #13.
- The repo becomes an npm workspace with one package.

## Owner decisions (2026-11-25)

The owner answered the open questions on 2026-11-25. The record stays `proposed` until the
device measurement in item 1 is done.

1. **Device measurement: measure first.** Time MODERATE (256 MiB) and INTERACTIVE (64 MiB)
   Argon2id in current Chrome, Firefox and Safari, and on a low-end phone. If the slowest
   target device unlocks in about 2 seconds or less with MODERATE, keep MODERATE. Otherwise
   use INTERACTIVE everywhere; the 15-character minimum in item 2 is what makes that
   acceptable. Record the measurements here before changing the status to `accepted`.
2. **Passphrase minimum: yes, 15 characters,** with no composition rules, per NIST
   SP 800-63B-4. #15 enforces it when a store is created and when the passphrase changes.
3. **"Change passphrase" always rotates: confirmed.** It creates a new master key and
   re-encrypts every field, as decision 4 describes.
4. **`UnsupportedFormatError` may be distinguishable: accepted.** It reveals only that the
   data was written by a different format version, which is not sensitive, and without it a
   user on an older version would see "wrong passphrase" forever.
5. **Package license: Apache-2.0, not AGPL.** The reusable package is licensed separately
   from Cadre so that other applications, including closed-source ones, can use it. Apache-2.0
   over MIT for its explicit patent grant. It is named **`keyslot`**, not scoped to Cadre, and should move to its own repository before it takes outside contributions, so
   AGPL-licensed contributions to Cadre never mix into it.
6. **No `role` blind index: confirmed.** Phase 2 will not need server-side exact-match search
   by role. Role filtering happens in the client after decryption.

## Sources

All checked on 2026-11-25. Constant values were also read directly from
`libsodium-wrappers-sumo` 0.8.4.

- libsodium, password hashing (`crypto_pwhash`, limits, storing parameters):
  <https://doc.libsodium.org/password_hashing/default_phf>
- libsodium, key derivation (`crypto_kdf_derive_from_key`, context, subkey IDs):
  <https://doc.libsodium.org/key_derivation>
- libsodium, padding (`sodium_pad`, ISO/IEC 7816-4): <https://doc.libsodium.org/padding>
- libsodium source, Argon2id called with one thread:
  <https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_pwhash/argon2/pwhash_argon2id.c>
- libsodium.js README (sumo build contains `crypto_pwhash`; `ready`; `memzero`):
  <https://github.com/jedisct1/libsodium.js>
- MDN, `SubtleCrypto.importKey` (`extractable`, raw keys, secure contexts):
  <https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey>
- MDN, `AesGcmParams` (`iv`, `additionalData`, `tagLength`):
  <https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams>
- MDN, `SubtleCrypto.encrypt`:
  <https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt>
- MDN, CSP `script-src` (`'wasm-unsafe-eval'`):
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src>
- NIST SP 800-38D, sections 5.2.1.1, 8, 8.2.2 and 8.3 (96-bit IVs, the 2^-32 bound, the 2^32
  limit for random IVs):
  <https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf>
- NIST SP 800-63B-4, section 3.1.1.2 (NFC normalization, 15-character minimum):
  <https://pages.nist.gov/800-63-4/sp800-63b.html>
- RFC 9106, section 4 (Argon2id recommended parameters):
  <https://www.rfc-editor.org/rfc/rfc9106.html>
- OWASP Password Storage Cheat Sheet (Argon2id minimums, PBKDF2):
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
