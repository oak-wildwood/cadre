# Tactical Tech — Holistic Security Guide

Source: <https://holistic-security.tacticaltech.org> · Tactical Tech · accessed from
documented knowledge of the guide's public structure (no live fetch — see note at bottom).

## Takeaways for a membership/contact ledger

- [feature] The guide's central move is refusing to separate "digital," "physical," and
  "psychosocial" security — an org's data-handling practices are treated as inseparable from
  who has keys to the office and who's burning out from stress. For Cadre this argues for
  documenting operational guidance (who holds recovery keys, what happens if an admin leaves
  the org angry) alongside the software, not just shipping crypto and calling it done.
- [feature] Its risk-assessment method models risk from three components an org can actually
  assess: **capacities** (what protective resources/skills the org has), **threats**
  (intentional harm from an adversary), and **vulnerabilities** (weaknesses a threat could
  exploit). A ledger's UI could usefully expose the org's own vulnerabilities back to them —
  e.g. "3 admins have never rotated their passphrase" — rather than only enforcing invisible
  crypto guarantees.
- [feature] The guide has a dedicated organizational-security strand covering onboarding,
  offboarding, and role turnover — precisely the moment membership ledgers are weakest (an
  ex-member or ex-admin who still has access or old exports). This backs prioritizing
  role-based access and clean offboarding/revocation flows.
- [avoid] It warns against security practices so burdensome that members route around them
  (shadow spreadsheets, unencrypted chat exports) — a caution against making the ledger's
  legitimate-use path slower than the insecure alternative members will improvise instead.
- [feature] It treats "data management" as its own topic distinct from general digital
  security: what's collected, where it's stored, who can access it, and for how long — the
  same three questions (collection, access, retention) that map directly onto Cadre's
  `sensitiveFields.ts` + `expires_at` design.
- [avoid] It flags that informal contact lists and spreadsheets circulated over email or chat
  are a common real-world failure mode for small groups — the exact anti-pattern a usable
  ledger needs to be a strictly better alternative to, in speed as well as security.
- Its digital-security chapters are somewhat dated on specific tool recommendations (the
  strength of the guide is the risk-assessment framework, not the current tool matrix) — treat
  its process/organizational content as more durable than any named tool.

## Threat-model language

The guide's risk-assessment vocabulary is **capacities / threats / vulnerabilities (CTV)**,
with threat further broken into an actor's *intention* and *capability*. This is a slightly
richer decomposition than EFF's five-question framework — it separately asks not just "who is
the adversary and what can they do" but "what weaknesses in our own practice would let them
succeed," which is a useful axis `docs/threat-model.md` doesn't currently name explicitly (the
existing table has adversary/capability/mitigation columns but no separate vulnerability
column).

## Feature / anti-feature summary

- `[feature]` expose org-facing "vulnerability" signals (stale passphrases, orphaned admin
  access) rather than only silent cryptographic guarantees
- `[feature]` first-class offboarding/access-revocation flow tied to role changes
- `[avoid]` UX friction that pushes members toward exporting data into unencrypted spreadsheets
  or chat
- `[feature]` consider adding a vulnerability column to `docs/threat-model.md`'s adversary table

---
*No live network access was available when writing this note; content reflects the guide's
long-standing, well-documented public structure rather than a fetch of the current page. A
maintainer should confirm against <https://holistic-security.tacticaltech.org> before citing
section names verbatim.*
