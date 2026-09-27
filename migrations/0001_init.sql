-- Members: non-sensitive columns in the clear, one *_enc bytea column per
-- sensitive field (see src/domain/member.ts's SensitiveField, the interim
-- source of truth until sensitiveFields.ts lands) and one *_bidx bytea
-- column per blind-indexed field. displayName is required and so is its
-- _enc/_bidx pair; email, phone and notes are optional.
create table members (
  id uuid primary key default gen_random_uuid(),
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,

  display_name_enc bytea not null,
  display_name_bidx bytea not null,

  email_enc bytea,
  email_bidx bytea,

  phone_enc bytea,
  phone_bidx bytea,

  notes_enc bytea,
  notes_bidx bytea
);

create index members_expires_at_idx on members (expires_at);
create index members_display_name_bidx_idx on members (display_name_bidx);
create index members_email_bidx_idx on members (email_bidx);
create index members_phone_bidx_idx on members (phone_bidx);
create index members_notes_bidx_idx on members (notes_bidx);

-- Org-level defaults. Single row, enforced by a fixed primary key rather
-- than a separate constraint.
create table settings (
  id integer primary key default 1,
  default_retention_days integer,
  updated_at timestamptz not null default now()
);
