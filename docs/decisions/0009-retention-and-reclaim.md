# 0009 — Retention default and reclaiming deleted rows

**Status:** proposed
**Date:** 2026-11-26

Answers Q3 in `docs/threat-model.md` for now, and records how retention defaults work (#13).

## Decision

1. **Deleting or purging a member runs `VACUUM FULL members`, then retires the write-ahead log:**
   `SET wal_recycle = off`, `pg_switch_wal()`, `CHECKPOINT` (twice). Postgres normally recycles a
   finished WAL segment by renaming it with its old bytes intact, so without this step the
   deleted row's ciphertext survives in `pg_wal`. With it, a test finds no copy of the ciphertext
   in any PGlite file after a delete or a purge.
2. **Per-record data keys are deferred.** Q3 lists them as the other option. Today every row is
   encrypted under the store's key hierarchy (0007), so a copy of the ciphertext taken _before_
   the delete (a backup, a synced device, a snapshot) stays readable by anyone holding the store
   key. This decision does not make delete final against that copy; it only removes the copies
   the store itself leaves behind. Real crypto-shredding needs a key-hierarchy change and its own
   record.
3. **The browser's IndexedDB backing store is not controlled.** The tests run on in-memory PGlite.
   Under `idb://`, the browser's engine may keep deleted values until it compacts. User-facing
   docs say so rather than promising more.
4. **`NewMember.expiresAt` has three states:** a date, `null` (never expires, explicit), and
   omitted (`undefined`, which takes the org default from `settings.default_retention_days`).
   With no default set, omitted behaves like `null`. Changing the default never rewrites
   existing members.

## Why

Retention exists so a seized or leaked store holds only what the org still needs (AGENTS.md rule
2, threat-model rows A1 and A7). A delete that leaves ciphertext in the WAL, or a purge that does
not reach it, defeats that. Using `undefined` versus `null` lets the repository interface express
"inherit" and "never" without a new field, but it is easy to get wrong, so it is written down.

## Alternatives considered

- **`VACUUM FULL` only** (what #10 shipped): leaves the WAL residue.
- **Per-record data keys now:** the right long-term answer to Q3, but a key-hierarchy change far
  beyond #13's scope.
- **A separate `NO_EXPIRY` sentinel or a boolean `neverExpires`:** more explicit, but a second
  way to say the same thing the existing `null` already says.

## Consequences

- Every delete and purge pays for a rewrite, a WAL switch and two checkpoints. Fine at this
  store's size; revisit if it grows large.
- `docs/threat-model.md` Q3 should be marked partly answered by this record once Oak approves it.
