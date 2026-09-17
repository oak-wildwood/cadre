# 0002 — License and contribution mechanics

**Status:** accepted
**Date:** 2026-09-17

## Decision

Cadre is licensed under the GNU Affero General Public License, version 3.0 (AGPL-3.0), full
text in [`LICENSE`](../../LICENSE). Contributions are accepted under the Developer Certificate
of Origin (DCO): a `Signed-off-by` trailer on each commit, no separate CLA paperwork.

## Why, and what threat it addresses

The threat model's "legal compulsion" row assumes an adversary can compel disclosure from
whoever operates the server. A hosted fork run by an untrusted party is the same risk wearing
a different hat: a bad-faith host could take Cadre, strip the encryption or add a backdoor, and
run it as a service for mutual aid groups or tenant unions — without ever "distributing" the
modified code, and so without triggering a plain-GPL copyleft obligation to publish it. That
gap is exactly what the Affero clause (AGPL §13) closes: any network-served modified version
must offer its users the Corresponding Source. A permissive license (MIT/Apache-2.0) has no
answer to this at all, and plain GPL only reaches redistribution, not network use. AGPL keeps
every hosted fork auditable by the people who depend on it, which is the property this project
needs more than it needs corporate-friendly licensing terms. DCO over CLA is a lower-friction
choice for the small-org and practitioner contributors this project wants, and needs no
paperwork or assignment infrastructure to maintain.

## Alternatives considered

- **MPL-2.0** — file-level copyleft; friendlier to embedding, but a hosted fork could add
  server-only files under a different license and never publish them, weakening the
  hosted-service guarantee AGPL provides.
- **MIT / Apache-2.0** — permissive; maximizes adoption but gives a hosted fork by an
  untrusted party no obligation to publish modifications, which is the exact risk this
  decision exists to close.
- **CLA** — gives the project more legal flexibility (e.g. relicensing later), but adds
  paperwork friction for the volunteer/practitioner contributors this project depends on, for
  a benefit this project doesn't currently need.

## Consequences

Every network-served modification of Cadre, including a hosted fork by an org this project
doesn't control, must make its source available to its users — the license itself enforces
part of the threat model instead of relying on trust. This does reduce corporate adoption and
embedding into proprietary products, an accepted tradeoff given the intended audience.
Contributors sign off commits (`git commit -s`) rather than sign a CLA; CI must check for the
`Signed-off-by` trailer going forward. Any future decision to relicense (e.g. dual-licensing for
a funding model) requires tracking down every contributor for consent, since there is no CLA
assigning or licensing-back rights — that cost is accepted now in exchange for lower
contribution friction.
