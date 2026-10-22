-- Sensitive columns (*_enc) and blind-indexed columns (*_bidx) mirror the
-- interim SensitiveField list in src/domain/member.ts (displayName, email,
-- phone, notes); sensitiveFields.ts will become the single source. Notes are
-- never searchable, so they have no blind index. Ciphertext only: no
-- plaintext PII column exists.
CREATE TABLE members (
  id uuid PRIMARY KEY,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  display_name_enc bytea NOT NULL,
  display_name_bidx bytea,
  email_enc bytea,
  email_bidx bytea,
  phone_enc bytea,
  phone_bidx bytea,
  notes_enc bytea
);

CREATE INDEX members_expires_at_idx ON members (expires_at);
CREATE INDEX members_display_name_bidx_idx ON members (display_name_bidx);
CREATE INDEX members_email_bidx_idx ON members (email_bidx);
CREATE INDEX members_phone_bidx_idx ON members (phone_bidx);

-- Org-level defaults (e.g. default retention). Values are non-sensitive config.
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
