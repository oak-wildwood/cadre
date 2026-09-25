-- Initial schema: members ledger and org-level settings.
--
-- Sensitive columns hold ciphertext only (`*_enc`) plus an HMAC blind index
-- (`*_bidx`) for equality-only lookups (AGENTS.md: blind indexes are for
-- equality only, never substrings or prefixes). The sensitive field list
-- mirrors `SensitiveField` in src/domain/member.ts, the interim source of
-- truth until `sensitiveFields.ts` (a separate issue) lands — keep the two
-- in sync rather than maintaining the list twice.

CREATE TABLE members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    role text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,

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

-- One row per org: a single PGlite/Postgres database is one org's ledger,
-- so the application (not a schema constraint) is what keeps this to one
-- row.
CREATE TABLE settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    default_retention_days integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
