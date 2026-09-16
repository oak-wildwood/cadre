# Cadre

A self-hostable, local-first membership ledger for small organizations that cannot afford to
leak their member list: mutual aid groups, tenant unions, organizing committees, small
newsrooms.

It stores names, contact info, roles and notes. All of it is treated as sensitive, encrypted
before it reaches storage, and deleted on a schedule you choose.

**Status:** pre-alpha. Scoped, not yet usable. See [docs/roadmap.md](docs/roadmap.md).

## Principles

1. **Never write cryptographic primitives.** Compose libsodium, `age`, WebCrypto, `pgcrypto`
   or OpenBao transit only.
2. **Don't keep what you can't protect.** Retention and deletion are first-class features,
   not afterthoughts.
3. **Every architectural choice gets a written reason** — what it does and what threat it
   addresses — in [docs/decisions/](docs/decisions/).
4. **Free and open source, end to end.** No paid services are required to develop or run it.
   Cloud (EKS) templates are provided and validated, never applied by this project.
5. **Storage goes through one repository interface.** The same app runs against
   Postgres-in-the-browser and Postgres-on-a-server, so migrating between them is a
   re-encryption, not a rewrite.

## Threat model (summary)

| Adversary | Capability | What Cadre does about it |
|---|---|---|
| Opportunistic attacker | Stolen laptop, leaked backup, phished account | Client-side + field-level encryption; no plaintext PII at rest anywhere |
| Legal compulsion | Subpoena to the host or the org | Minimal retention, crypto-shredding, host cannot decrypt end-to-end fields |
| Compromised server | Full database read | Envelope encryption; data keys wrapped by a key held outside the DB; blind indexes only |
| Device seizure | Physical access to a locked or unlocked device | Passphrase-derived local key, panic wipe, optional duress mode |
| Insider / careless member | Over-broad access | Row-level security, least-privilege roles, audit log on PII reads |

### What this does *not* protect against

Metadata and contact-graph analysis, network-level anonymity (use Tor), and malware on the
endpoint. If those are in your threat model, Cadre is one layer, not the answer.

## Stack

TypeScript · Vue · PGlite (browser) · Postgres (server) · OpenBao (keys and secrets) ·
Helm + kind (local cluster) · GitHub Actions · OpenTofu (AWS templates).

## Contributing

Work is tracked as GitHub issues grouped by milestone. Read [AGENTS.md](AGENTS.md) for the
rules that apply to every change, human- or agent-authored.
