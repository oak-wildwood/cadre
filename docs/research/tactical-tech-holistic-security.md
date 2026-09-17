# Tactical Tech — Holistic Security Guide

Source: <https://holistic-security.tacticaltech.org> · Tactical Tech · confirmed against the
live site on 2026-09-17 (see note at bottom for what changed after that check).

## Takeaways for a membership/contact ledger

- [feature] The guide's central move is refusing to separate "digital," "physical," and
  "psychosocial" security — an org's data-handling practices are treated as inseparable from
  who has keys to the office and who's burning out from stress. It frames this explicitly as
  security-as-**"well-being in action"** and organizes the whole guide as a cyclical four-phase
  process — **Prepare → Explore → Strategise → Act** — meant to be revisited, not a one-time
  checklist. For Cadre this argues for documenting operational guidance (who holds recovery
  keys, what happens if an admin leaves the org angry) alongside the software, not just
  shipping crypto and calling it done, and for treating the threat model itself as something
  to revisit rather than freeze after Phase 0.
- [feature] Within that cycle, the Explore phase (chapter 2.8, "Identifying and Analysing
  Threats") and the Strategise phase that follows it build up a risk-assessment vocabulary of
  **capacities** (protective resources/skills the org has), **threats** (an adversary's intent
  and capability to cause harm), and **vulnerabilities** (gaps in practice or resources a
  threat could exploit) — not a single named "CTV model" packaged in one place, but the same
  three components in practice. A ledger's UI could usefully expose the org's own
  vulnerabilities back to them — e.g. "3 admins have never rotated their passphrase" — rather
  than only enforcing invisible crypto guarantees.
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

The guide's top-level model is the four-phase cycle **Prepare / Explore / Strategise / Act**,
not a risk-assessment acronym — that's worth citing by name if `docs/threat-model.md` wants to
credit prior art for "revisit this periodically" as a structure, not just a vocabulary. The
finer-grained vocabulary introduced inside Explore/Strategise — **capacities / threats /
vulnerabilities** — is a richer decomposition than EFF's five-question framework: it separately
asks not just "who is the adversary and what can they do" but "what weaknesses in our own
practice would let them succeed," which is a useful axis `docs/threat-model.md` doesn't
currently name explicitly (the existing table has adversary/capability/mitigation columns but
no separate vulnerability column).

## Feature / anti-feature summary

- `[feature]` expose org-facing "vulnerability" signals (stale passphrases, orphaned admin
  access) rather than only silent cryptographic guarantees
- `[feature]` first-class offboarding/access-revocation flow tied to role changes
- `[avoid]` UX friction that pushes members toward exporting data into unencrypted spreadsheets
  or chat
- `[feature]` consider adding a vulnerability column to `docs/threat-model.md`'s adversary table

---
*Confirmed against the live site on 2026-09-17. The organizational-security, data-management,
and threat-identification content described above all check out (chapters 2.4, 2.8, and 3.4).
One correction from that check: the original version of this note presented "capacities /
threats / vulnerabilities" as the guide's single named framework. The guide's actual top-level
structure is the four-phase **Prepare / Explore / Strategise / Act** cycle, framed around
security as "well-being in action"; capacities/threats/vulnerabilities is vocabulary introduced
partway through that cycle (Explore into Strategise), not a standalone model. Both are now
described accurately above.*
