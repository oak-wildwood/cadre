# crypto

Thin wrappers around libsodium / WebCrypto / `age` / OpenBao transit only. No hand-rolled
cipher, KDF, MAC or random-number code — see `AGENTS.md` rule 1.

The key slot, `KeyRing` and field encryption live in the standalone
[`keyslot`](../../packages/keyslot/README.md) workspace package (record 0007, decision 10). This
folder holds only the Cadre-specific glue around it:

- `memberFields.ts` turns a member's sensitive fields (listed in
  `src/domain/sensitiveFields.ts`) into ciphertexts and back, binding each to
  `members / <member UUID> / <field name>`. Member ids are made in the browser with
  `newMemberId()` before encrypting, because the id is part of the AAD.
- `unlockStore.ts` unlocks with the settings stored in the slot and, if they are below the
  current Argon2id defaults, returns a re-wrapped slot for the caller to save.

A forgotten passphrase means the data is gone. That is intended; there is no recovery path.
