# EFF Surveillance Self-Defense

Source: <https://ssd.eff.org> · Electronic Frontier Foundation · confirmed against the live
site on 2026-09-17 (see note at bottom).

## Takeaways for a membership/contact ledger

- [feature] SSD's "Your Security Plan" module frames risk as six questions: what do you want
  to protect, who do you want to protect it from, how bad are the consequences if you fail,
  how likely is it that you'll need to protect it, how much trouble you're willing to go
  through, and **who your allies are**. A ledger that stores a member list should let an org
  answer these per-org, not assume one answer fits everyone — e.g. a tenant union and a
  newsroom have different consequence tolerances for the same leak. The "allies" question is
  also a reminder that an org's mitigations aren't only technical — who else (a legal
  hotline, a sister org) they can call on is part of their actual security posture, even
  though it's outside anything Cadre's software can encode.
- [avoid] SSD repeatedly warns that metadata (who talked to whom, when, how often) can be as
  revealing as content, sometimes more so, because it's cheaper to collect and harder to
  encrypt away. A membership ledger *is* a metadata store — a list of who is affiliated with
  what — which is exactly the shape of data SSD treats as high-risk even before content (notes,
  roles) is considered.
- [feature] SSD's guidance on device seizure emphasizes full-disk encryption plus a strong,
  unique passphrase, and warns that a device that's merely locked (not powered off) can be far
  easier to compel or extract data from. Relevant to any local-first client: encryption at rest
  keyed to a passphrase, not just an OS lock screen.
- [feature] SSD distinguishes "who might come after you" by capability (a random criminal vs. a
  state actor vs. an abusive individual with physical access) — this directly maps onto the
  multiple adversary rows already listed in Cadre's own threat model summary.
- [avoid] SSD advises minimizing what's collected and retained in the first place — the
  cheapest defense against compelled disclosure is not having the data. This backs the
  project's existing retention/crypto-shred design rather than suggesting anything new.
- [feature] SSD's communicating-with-others guidance favors tools with forward secrecy and
  minimal server-side metadata retention (e.g. Signal) as the reference point for "good"
  secure communication — a useful external benchmark when Cadre later documents its own
  transport/at-rest guarantees.
- SSD content is aimed at individuals more than organizations; it has comparatively little to
  say about role-based access, audit logs, or multi-user administration, which is where
  Tactical Tech's organizational-security material fills the gap.

## Threat-model language

SSD's core framework is "Assessing Your Risk" / "Your Security Plan," built around the six
questions above — asset, adversary, consequence, likelihood, cost-of-mitigation, and allies. It
treats
"threat modeling" as an ongoing exercise, not a one-time checklist, and explicitly separates
*assets* (what you're protecting) from *adversaries* (who you're protecting it from) from
*capabilities* (what that adversary can actually do). This vocabulary is compatible with
`docs/threat-model.md`'s adversary/capability framing and can be cited as prior art for that
structure.

## Feature / anti-feature summary

- `[feature]` per-org configurable risk tolerance rather than a single fixed policy
- `[feature]` at-rest encryption keyed to a user-held passphrase, not device lock state alone
- `[avoid]` collecting or retaining fields beyond what the org actually needs
- `[feature]` adopt SSD's adversary/asset/capability vocabulary in `docs/threat-model.md`

---
*Confirmed against the live site on 2026-09-17: "Your Security Plan," the metadata module, the
device-encryption guides, and the Signal recommendation all check out. One correction from that
check: "Your Security Plan" asks six questions, not five — the original version of this note
omitted "Who are my allies?" Added above.*
