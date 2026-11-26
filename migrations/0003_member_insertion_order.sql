-- A total, insertion-ordered tie-breaker for `list` pagination. PGlite's clock ticks in
-- milliseconds, so members created back to back share a `created_at`, and the random UUID id
-- can't say which came first. `seq` carries nothing about a member beyond the order rows were
-- written in, which `created_at` already shows.
ALTER TABLE members ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX members_seq_idx ON members (seq);
