# Access Now — Digital Security Helpline

Source: <https://www.accessnow.org/help/> · Access Now · checked against the live page on
2026-09-17 (see note at bottom).

## Takeaways for a membership/contact ledger

- [feature] The Helpline is a 24/7 rapid-response service for civil society (activists,
  journalists, human rights defenders, small CSOs) dealing with live digital-security
  incidents, not general hardening advice. Its case mix — phishing, account takeover, malware,
  device confiscation, doxxing — is a useful, concrete list of "how the leak actually happens"
  scenarios to design against, versus more abstract adversary modeling.
- [avoid] The Helpline's published case types — compromised social media/email accounts,
  spyware and malware, website takedowns and blocks, account lockouts — skew toward account
  and access compromise rather than exotic technical attacks. (Their site doesn't publish a
  ranked incident-volume breakdown; this is a description of the case-type list itself, not a
  cited statistic.) Reinforces that credential/account security (2FA, phishing-resistant login,
  session handling) for whoever administers the ledger matters as much as most cryptographic
  edge cases.
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
*Checked this against the live page on 2026-09-17 — the 24/7, ten-language, and audience claims
all match. The case-type list above is descriptive, not a stat: Access Now doesn't publish a
ranked incident-volume breakdown, so don't cite one from here. Didn't independently re-confirm
"doxxing" or "device confiscation" as named case types — worth a second look if that specific
wording matters later.*
