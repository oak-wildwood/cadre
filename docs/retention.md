# Retention

Cadre deletes member records on a schedule you choose, so a leaked or seized store holds only
what you still need.

- **Each member can have an expiry date** (`expiresAt`). When it passes, the record is gone.
  Leaving the date unset means "use my organization's default"; choosing "never" is an explicit
  `null` and is kept.
- **The organization default** is a number of days (for example 365), stored in `settings`. It is
  applied when a member is created. Changing it later does not rewrite existing members' dates.
  No default is set until you set one, so nothing expires by surprise.
- **Purging** removes expired members for good: no soft delete, no leftover row. It runs when the
  app is opened and unlocked, and then every hour while it stays open. When something was removed
  you see a small "Purged N expired records" notice that you can dismiss.
- **What "for good" covers.** After a purge (or a manual delete) the store is rewritten and its
  write-ahead log is retired, so the record's bytes leave the local store. Copies made _before_
  the purge, such as an earlier export or a synced device, are untouched; delete those yourself.
  The key that encrypts the record is still shared across the store, so this is not yet
  per-record crypto-shredding (`docs/threat-model.md`, Q3).

For developers: `purgeExpired(now)`, `getDefaultRetentionDays()` and `setDefaultRetentionDays()`
are on `LedgerRepository`. `src/app/retention.ts` (`useRetention`) is the scheduler: `start()` is
the on-open hook, and the interval, clock and timer functions are injectable. Wire it up after
unlock and render `PurgeNotice.vue` from its `notice`.
