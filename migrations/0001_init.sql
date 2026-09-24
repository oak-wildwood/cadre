-- Column list mirrors src/domain/member.ts's `Member` and `SensitiveField` types — the
-- interim source of truth until sensitiveFields.ts lands (separate issue). Every
-- `SensitiveField` gets one `*_enc` bytea column (ciphertext) and one `*_bidx` bytea
-- column (HMAC blind index, equality-only per AGENTS.md); every other `Member` field
-- maps to a plain column. Keep this file's columns and that file's fields in sync
-- rather than re-deriving the list here.

create table members (
  id uuid primary key default gen_random_uuid(),

  -- non-sensitive
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,

  -- sensitive: displayName (required)
  display_name_enc bytea not null,
  display_name_bidx bytea not null,

  -- sensitive: email
  email_enc bytea,
  email_bidx bytea,

  -- sensitive: phone
  phone_enc bytea,
  phone_bidx bytea,

  -- sensitive: notes
  notes_enc bytea,
  notes_bidx bytea
);

create index members_expires_at_idx on members (expires_at);
create index members_display_name_bidx_idx on members (display_name_bidx);
create index members_email_bidx_idx on members (email_bidx);
create index members_phone_bidx_idx on members (phone_bidx);
create index members_notes_bidx_idx on members (notes_bidx);

-- Org-level defaults (e.g. default retention). Local-first phase 1 serves a single
-- org per deployment, so the application is responsible for treating this as a
-- singleton table; the schema does not enforce it.
create table settings (
  id uuid primary key default gen_random_uuid(),
  default_retention_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
