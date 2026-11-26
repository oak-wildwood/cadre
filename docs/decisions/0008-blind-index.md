# 0008 — Blind indexes: equality only, per-field normalization

**Status:** proposed
**Date:** 2026-11-26
**Issue:** #12. Builds on [0007](0007-key-derivation.md) (the blind-index subkey and the list of
indexed fields). Row names such as A3 and R1 refer to [the threat model](../threat-model.md).

Cadre has to find a member by name, email or phone without the database holding those values in
plaintext. We store, next to each encrypted value, an HMAC of its normalized form, and search by
exact match on that HMAC. This record fixes how the HMAC is computed, how values are normalized
first, and what that gives away. It replaces the interim `src/crypto/blindIndex.ts` from #10.

## Decisions

1. **Construction.** `blindIndex(field, value)` is HMAC-SHA-256 through WebCrypto, keyed with the
   `KeyRing`'s blind-index subkey (0007, decision 3; never the field key). The HMAC input is the
   UTF-8 bytes of `field + "\0" + normalize(field, value)`. The full 32-byte tag is stored in the
   `<column>_bidx bytea` column. Nothing here is a new primitive.
2. **The field name is in the input.** The same value in two fields (a phone number typed into
   `displayName`, say) gets two unrelated indexes, so an index never shows that a member's name
   equals another member's email.
3. **Equality only.** There is no prefix, substring, fuzzy, phonetic or n-gram index, and no
   index of any part of a value. Each of those would leak the structure of the plaintext: a
   prefix index on names lets anyone with the file group members by surname initial, and n-grams
   are enough to rebuild short values outright. Partial search ("all the Smiths") is done by
   decrypting in the browser and filtering there, as 0007 already does for `role`. A test asserts
   that partial values do not match.
4. **Normalization rules.** These are part of the format: changing them changes every index.

   | Field         | Rule                                                                                       |
   | ------------- | ------------------------------------------------------------------------------------------ |
   | every field   | Unicode NFKC, then trim, then collapse every run of whitespace to one space                |
   | `displayName` | the above, then lowercase (`toLowerCase`, locale-independent)                              |
   | `email`       | the above, then lowercase the whole address, including the local part                      |
   | `phone`       | keep a leading `+` if the trimmed value starts with one, then keep only the digits `0`–`9` |
   - **Lowercase, not full case folding.** JavaScript has no built-in full case fold, and we will
     not hand-roll Unicode tables. The visible gap is small (for example, `ß` and `ss` stay
     distinct). A missed match costs a duplicate member; a wrong match would merge two people.
   - **Email local parts are lowercased** even though RFC 5321 lets them be case-sensitive. No
     mainstream provider treats `Ada@` and `ada@` as different people. We do **not** strip dots
     or `+tags` (a Gmail-only convention): that would merge addresses that really are distinct
     elsewhere.
   - **Phone: no country-code inference.** `+1 555 0100` and `555 0100` index differently.
     Guessing a country would need a phone-number library and a default region, and a wrong
     guess merges two people. The UI (#15) should show a stored number's format when a search
     misses. NFKC runs first, so full-width digits are matched.
   - **A value that normalizes to empty has no index.** Its `_bidx` is `NULL`, and
     `findByBlindIndex` with a value that normalizes to empty returns `[]`. Otherwise every
     member with a blank phone would share one index and searching for `""` would list them.

5. **Changing a rule later** means recomputing every index for that field in one transaction,
   in the browser, because only an unlocked `KeyRing` can compute them. That is the same
   operation as key rotation (0007), and it is cheap at Cadre's size. There is no version byte on
   an index: indexes are derived data, never exported, and always rebuilt from the plaintext.

## What a blind index gives away, and why we accept it

Anyone with the database file but not the passphrase (A1, A2, A4, and a Phase 2 host under A3)
learns, per indexed field:

- **Equality.** Which members share a normalized name, email or phone. Two members with the same
  phone are probably a household; two with the same email are probably a duplicate entry.
- **Frequency.** How often each value repeats. In a small org a repeated surname-and-first-name
  is rare, so in practice this mostly shows duplicates and households.
- **Linkage over time and across copies.** The same value gets the same index in every copy of
  the store made under the same master key, so two stolen backups can be matched row to row.
  Rotation (0007) changes every index and breaks that link for copies made afterwards.

It does **not** give away the value itself, its length, or any part of it, as long as the
blind-index subkey stays secret. Without the key, guessing "is Ada Lovelace a member?" needs the
key, so a host or thief cannot test names or phone numbers against the file. With the key, an
attacker could test every phone number offline quickly, but whoever holds that key holds the
master key and can decrypt everything anyway (0007, decision 3), so the index adds nothing.

This is threat-model residual risk **R1**, stated here as #12 must. We accept it because:

- the operator needs to find a member by an exact name, email or phone, and to catch duplicates
  on entry, and decrypting every row on each keystroke is fine in the browser but impossible for
  a Phase 2 server that must not see plaintext (A3);
- the leak is relationships between rows, not their contents, and the fields where grouping
  would hurt most (`role`, `notes`) are already excluded (0007, decision 9).

## Alternatives considered

- **No blind index; always decrypt and filter.** Leaks nothing, and works in Phase 1. Rejected
  because the Phase 2 server could then never look a member up, and because the contract and
  0007 already commit to `findByBlindIndex`.
- **Truncated indexes with deliberate collisions** (CipherSweet-style, a few bits per index so
  each one matches many rows). This blurs frequency, but at a few hundred members the useful
  truncation lengths either collide so often that search needs a full decrypt anyway or so
  rarely that they hide nothing. Revisit if a server ever holds very large orgs.
- **Deterministic encryption instead of an HMAC.** Gives equality search too, but reveals the
  value to anyone with the key and is easy to misuse as the stored ciphertext. An HMAC beside
  randomized AES-GCM keeps the two jobs, and the two keys, apart.
