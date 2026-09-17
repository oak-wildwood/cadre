# Agent instructions

Instructions for AI coding agents working in this repository. Humans should read the README.

## What this project is, and why it constrains you

Read from the source this looks like a small CRUD contact app. It isn't. It is a membership
ledger for organizations whose member list, if leaked, gets people evicted, fired, deported or
arrested. Every design choice is judged against the threat model in `docs/threat-model.md`
(summary in the README), and "convenient" loses to "recoverable by nobody but the org" every
time.

The product: a self-hostable, local-first membership/contact ledger for small organizations
(mutual aid groups, tenant unions, organizing committees, small newsrooms). Stores member names,
contact info, roles, notes. All PII is treated as sensitive.

## Hard rules

1. **Never write cryptographic primitives.** Compose libsodium, `age`, WebCrypto, `pgcrypto`,
   or OpenBao transit only. A hand-rolled cipher, KDF, MAC or random-number scheme is a
   vulnerability with a test suite. If you think you need one, you need a decision record and a
   human first.
2. **Don't keep what you can't protect.** Retention (`expires_at`) and deletion are
   first-class. Never add a code path that copies PII somewhere the purge logic doesn't reach:
   logs, error reports, caches, analytics, test fixtures with real-looking data.
3. **Every architectural choice gets a decision record** in `docs/decisions/` — one paragraph
   on *why* and *what threat it addresses*. A PR that changes the stack, the key hierarchy, the
   schema's sensitivity classification or the storage layer without a decision record is
   incomplete.
4. **Free and open source only.** No paid cloud services in development. AWS/EKS artifacts are
   written and `plan`-ed / `validate`-d, never `apply`-ed unless a human explicitly approves in
   the issue. An accidental `apply` costs real money on someone else's card.
5. **Storage goes through the repository interface.** No direct storage calls from UI or
   business logic. The interface is the migration boundary between browser (PGlite) and server
   (Postgres); bypassing it silently breaks the migration path and the contract tests.

## Invariants that are easy to break by accident

- **Sensitive fields are listed in one place** (`sensitiveFields.ts`, once it exists). Adding a
  column that holds PII without listing it there ships it in plaintext. Adding it to the list
  without a migration breaks existing rows.
- **The repository contract tests (`repository.contract.spec.ts`) must pass unchanged** against
  every repository implementation. Editing the contract to make a new adapter pass is the
  wrong direction; fix the adapter.
- **Blind indexes are for equality only.** HMAC of a normalized value. Do not "improve" search
  by indexing substrings or prefixes of encrypted fields; that leaks the plaintext structure.
- **Exports are encrypted by default.** A plaintext export option, if it is ever added, is
  explicit, warned, and never the default.
- **Crypto-shred means the key is gone.** Deleting a member or org destroys its data key;
  backups made before deletion must become unreadable. A "soft delete" that leaves the key in
  place is not deletion here.

## Stack defaults

Change only with a decision record: TypeScript; Vue for UI; PGlite in the browser; Postgres on
the server; OpenBao for keys and secrets; Helm + kind locally; GitHub Actions for CI; OpenTofu
for AWS templates.

## Working in this repo

**Definition of done for any task:** code + tests + a short doc note + an updated or new
decision record if a choice was made.

**Scope is the issue, not the phase.** Each issue is one task. Do not pull forward work from a
later issue because it "will be needed anyway"; the roadmap sequences things deliberately so
that each phase leaves a coherent, shippable project.

**Out of scope for this project, and stated openly:** metadata/contact-graph analysis,
network-level anonymity, endpoint malware. Don't add features that imply otherwise.

### PR titles become commit messages

This repo squash-merges, and the squashed commit takes the **PR title** as its subject with an
empty body. So the PR title is not a label on a discussion — it is the permanent record of the
change in `git log`, and it is the only part that survives the merge.

Write it as a conventional commit: `type: imperative summary`, lowercase after the colon, no
trailing period, **66 characters or fewer**. That's not a style suggestion — `pr-title.yml` enforces
it as a required check and fails the PR otherwise. 66 rather than 72 because GitHub appends
" (#123)" to the squashed subject; budgeting for it here keeps the finished commit subject inside
the conventional 72. Count the title before opening the PR — a failed check that gets bypassed
(e.g. by an admin merging anyway) still lands a title over budget permanently in `git log`.

```
feat: add encrypted export bundle
fix: stop purgeExpired skipping rows with a null org default
test: add repository contract tests
docs: record why blind indexes are equality-only
ci: run gitleaks on pull requests
refactor: extract key derivation into its own module
chore: bump libsodium-wrappers
```

Use `feat` and `fix` for changes a user would notice, and `refactor` for ones they wouldn't.
`test`, `docs`, `ci` and `chore` cover the rest. When a change spans several types, name the one
that carries the point of the PR rather than the one touching the most files.

Individual commits on the branch don't survive the squash, so they're for the reviewer rather
than for history.
