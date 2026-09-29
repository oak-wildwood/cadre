-- Sensitive-field column names (display_name, email, phone, notes) are the
-- SQL-cased form of `SensitiveField` in src/domain/member.ts, the interim
-- source of truth until `sensitiveFields.ts` lands (separate issue). Every
-- sensitive field gets a `*_enc` bytea column for its ciphertext; fields
-- `LedgerRepository.findByBlindIndex` can be searched by also get a
-- `*_bidx` bytea column holding a blind index (HMAC of the normalized
-- value), never the plaintext or a partial/prefix hash — see AGENTS.md's
-- blind-index invariant.

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Non-sensitive, structural columns. Safe to filter and order on directly
  -- (see src/domain/listQuery.ts); never used to carry PII.
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,

  -- displayName is required on every member (see Member in
  -- src/domain/member.ts), so its columns are NOT NULL; the rest are
  -- optional fields and stay nullable.
  display_name_enc bytea NOT NULL,
  display_name_bidx bytea NOT NULL,

  email_enc bytea,
  email_bidx bytea,

  phone_enc bytea,
  phone_bidx bytea,

  notes_enc bytea,
  notes_bidx bytea
);

CREATE INDEX members_expires_at_idx ON members (expires_at);
CREATE INDEX members_display_name_bidx_idx ON members (display_name_bidx);
CREATE INDEX members_email_bidx_idx ON members (email_bidx);
CREATE INDEX members_phone_bidx_idx ON members (phone_bidx);
CREATE INDEX members_notes_bidx_idx ON members (notes_bidx);

-- Org-level defaults (e.g. default retention). Phase 1 is one local
-- ledger per browser instance, so this is a singleton row, enforced by a
-- boolean primary key that can only ever be `true`; Phase 2's multi-org
-- server layer is out of this issue's scope.
CREATE TABLE settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_retention_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
