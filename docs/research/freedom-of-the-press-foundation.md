# Freedom of the Press Foundation — Digital Security Training

Source: <https://freedom.press/training/> · Freedom of the Press Foundation · confirmed
against the live page on 2026-09-17 (see note at bottom).

## Takeaways for a membership/contact ledger

- [feature] FPF's training is built around **source protection**: the working assumption that
  a list of who talked to a journalist is itself the sensitive asset, independent of what was
  said. This is the closest analogue in any of the four sources to Cadre's actual object — a
  list of *who is affiliated*, not a list of documents. Its "the list of contacts is the
  target" framing is directly reusable for `docs/threat-model.md`.
- [avoid] FPF materials repeatedly stress that a source list surviving in *any* durable form —
  a notebook, an old phone backup, a synced contacts app — undermines every other precaution
  taken around a specific story. Translated to Cadre: an export, backup, or debug log that
  outlives the retention policy defeats the whole design, matching AGENTS.md's "don't keep
  what you can't protect" rule.
- [feature] FPF pushes compartmentalization: separate devices/accounts for sensitive source
  work versus daily use, so a compromise of one doesn't cascade. For a multi-org or
  multi-admin ledger this argues for strict per-org key isolation (already implied by
  crypto-shred-per-org) and against any shared "god mode" credential across orgs.
- [feature] Their SecureDrop-adjacent guidance treats the *submission* channel and the *storage*
  of what's submitted as separate trust boundaries with separate hardening — a useful reminder
  that Cadre's "how a new member's info gets in" (import, manual entry, future intake forms)
  deserves its own scrutiny distinct from how it's stored afterward.
- [feature] FPF trains newsroom staff (not just individual journalists) on password managers,
  two-factor authentication, and device security as baseline hygiene before any tool-specific
  advice — reinforcing that a ledger's own security is necessary but not sufficient if the
  admin's device or account is weakly protected.
- [avoid] Training materials warn against ad hoc, undocumented security practices that live
  only in one person's head — when that person leaves, the practice disappears. Argues for
  Cadre's own operational security guidance (key custody, break-glass recovery) being written
  down, not tribal knowledge.
- FPF's content is written for journalist/newsroom contexts specifically (legal privilege,
  reporter's shield laws) which don't map 1:1 onto mutual aid or tenant-union contexts already
  in Cadre's target audience — useful as an intensity benchmark, not a direct spec.

## Threat-model language

FPF frames risk around **source protection** and treats legal compulsion (subpoena, court
order to produce a source list or communications) as a first-class adversary category, not an
edge case — directly matching the "legal compulsion" row already in Cadre's threat-model
summary. It also uses "compartmentalization" and "attack surface" as recurring terms for
reasoning about which systems a compromise could reach.

## Feature / anti-feature summary

- `[feature]` treat data intake (import/entry) as its own trust boundary, reviewed separately
  from storage
- `[feature]` strict per-org key isolation; no cross-org admin credential
- `[avoid]` any durable copy of member data outside the retention/purge boundary (backups,
  logs, exports)
- `[feature]` write down key-custody / break-glass recovery procedure rather than leaving it as
  one admin's tribal knowledge

---
*Confirmed against the live page on 2026-09-17: the "Source Protection" collection, the
journalist/documentary-filmmaker audience, and the Organizational Security Audits program all
check out as described — including a near-verbatim match on the source-protection framing
("The effort to protect your sources needs to start before they contact you"). No corrections
needed.*
