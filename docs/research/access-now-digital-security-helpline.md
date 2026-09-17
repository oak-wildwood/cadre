# Access Now — Digital Security Helpline

Source: <https://www.accessnow.org/help/> · Access Now · accessed from documented knowledge of
the helpline's public program description (no live fetch — see note at bottom).

## Takeaways for a membership/contact ledger

- [feature] The Helpline is a 24/7 rapid-response service for civil society (activists,
  journalists, human rights defenders, small CSOs) dealing with live digital-security
  incidents, not general hardening advice. Its case mix — phishing, account takeover, malware,
  device confiscation, doxxing — is a useful, concrete list of "how the leak actually happens"
  scenarios to design against, versus more abstract adversary modeling.
- [avoid] Account takeover and phishing dominate their incident volume in public reporting,
  ahead of exotic technical attacks — reinforcing that credential/account security (2FA,
  phishing-resistant login, session handling) for whoever administers the ledger matters more
  than most cryptographic edge cases.
- [feature] They explicitly serve under-resourced, non-technical organizations and design
  their intake and advice for people without security staff — the same audience Cadre targets.
  Their existence as a "call for help when something's already gone wrong" service argues
  Cadre should have a documented incident-response path (what to do if an admin's laptop is
  stolen: revoke, rotate, rely on crypto-shred) rather than assuming prevention is the whole
  story.
- [feature] Device confiscation/seizure is a recurring case type in their public reporting,
  particularly at border crossings and protests — matching the "device seizure" row already in
  Cadre's threat model and reinforcing panic-wipe/duress-mode as scoped-in work (Phase 6), not
  speculative.
- [avoid] Their guidance leans toward "do no harm" — don't recommend a security practice a
  group can't sustain, since an abandoned control is worse than a modest one that's actually
  followed. Argues against defaults so strict (e.g. mandatory hardware keys) that a
  volunteer-run org disables them.
- [feature] They operate multilingually and explicitly for global-majority, resource-constrained
  organizations — a reminder that Cadre's self-hosting story (README's "free and open source,
  end to end") matters as much as its cryptography for its actual audience, who may not trust
  or be able to afford a hosted SaaS alternative.
- Their published resources are triage-oriented rather than architectural — useful for incident
  scenarios to test against, less useful for informing storage-layer design decisions.

## Threat-model language

Access Now doesn't publish a single named framework the way EFF or Tactical Tech do; instead
its public materials talk in terms of **digital emergencies** / **incidents** and categorize
requesters by sector (civil society, journalists, HRDs) and adversary by type (state-sponsored,
criminal, unknown). The practical framing — "what do we do once compromise has already
happened" — complements the preventive framing of the other three sources and argues for an
explicit incident-response section in `docs/threat-model.md` alongside the preventive
adversary table.

## Feature / anti-feature summary

- `[feature]` documented incident-response runbook (stolen device, compromised admin account)
  distinct from preventive controls
- `[feature]` strong-but-optional 2FA/account-security defaults for admin accounts, sized to a
  volunteer-run org's actual capacity
- `[avoid]` mandatory controls strict enough that an under-resourced org disables or routes
  around them
- `[feature]` self-hosting remains a first-class option, not just a compliance checkbox, for
  orgs that can't trust a third-party host

---
*No live network access was available when writing this note; content reflects the helpline's
long-standing, well-documented public program description rather than a fetch of the current
page. A maintainer should confirm against <https://www.accessnow.org/help/> before citing
specifics verbatim.*
