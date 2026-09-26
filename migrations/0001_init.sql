-- Initial schema: members ledger and org-level settings.
--
-- Column names must stay in sync with `src/domain/member.ts`'s `SensitiveField`
-- union (the interim source of truth until `sensitiveFields.ts` lands) — one
-- `*_enc` and one `*_bidx` column per sensitive field, per AGENTS.md's
-- sensitive-fields and blind-index invariants. Non-sensitive columns
-- (`role`, `created_at`, `updated_at`, `expires_at`) stay in plaintext.

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text,

  display_name_enc bytea NOT NULL,
  display_name_bidx bytea NOT NULL,
  email_enc bytea,
  email_bidx bytea,
  phone_enc bytea,
  phone_bidx bytea,
  notes_enc bytea,
  notes_bidx bytea,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX members_expires_at_idx ON members (expires_at);
CREATE INDEX members_display_name_bidx_idx ON members (display_name_bidx);
CREATE INDEX members_email_bidx_idx ON members (email_bidx);
CREATE INDEX members_phone_bidx_idx ON members (phone_bidx);
CREATE INDEX members_notes_bidx_idx ON members (notes_bidx);

-- Org-level defaults. Single row, enforced by the `id` check below — this is
-- not a general key/value store.
CREATE TABLE settings (
  id boolean PRIMARY KEY DEFAULT true,
  default_retention_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id)
);
