-- Applies docs/decisions/0007-key-derivation.md, decision 9. Column names follow
-- src/domain/sensitiveFields.ts, now the single source of truth for which
-- fields are encrypted (`*_enc`) and which also get an equality blind index
-- (`*_bidx`). No released version has written member data yet, so there are
-- no plaintext `role` values or `notes_bidx` values to carry over.

-- notes keeps its ciphertext but loses its blind index: exact-match search on
-- free text is rarely useful and the index would reveal identical notes.
DROP INDEX members_notes_bidx_idx;
ALTER TABLE members DROP COLUMN notes_bidx;

-- role is sensitive: "organizer" marks who to target first. Encrypted, and
-- deliberately not blind-indexed (few distinct values would group members).
-- Role filtering happens in the browser after decryption.
ALTER TABLE members DROP COLUMN role;
ALTER TABLE members ADD COLUMN role_enc bytea;

-- The member id is part of every encrypted value's AAD, so the adapter makes
-- it in the browser before encrypting. Dropping the default turns any insert
-- that forgets to into an error instead of a row that can't be decrypted.
ALTER TABLE members ALTER COLUMN id DROP DEFAULT;

-- Wrapped master keys. Each slot blob is self-describing (format version,
-- kind, Argon2id settings, salt, nonce, wrapped key; see the keyslot
-- package), so the table holds nothing that could unlock the data on its own.
-- One passphrase slot in Phase 1; more kinds can wrap the same master key
-- later. Re-wrapping rewrites `slot` and bumps `updated_at`.
CREATE TABLE key_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot bytea NOT NULL CHECK (octet_length(slot) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
