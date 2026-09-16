# Roadmap

Seven phases. Every phase after 1 is optional in the sense that stopping there still leaves a
coherent, usable project. Work is tracked as GitHub issues under a milestone per phase.

| Phase | Goal | Done when |
|---|---|---|
| **0 — Validate and threat-model** | Confirm the problem is real; shape the feature list from practitioner input. | `docs/threat-model.md` exists; at least two practitioner conversations logged in `docs/research/`; feature list adjusted. |
| **1 — Local-first core** | Browser-only app with encrypted local storage, export/import, retention. Establishes the repository interface every later phase implements. | Contract tests pass against `PGliteRepository`; a fresh browser imports an exported bundle with the passphrase; DevTools shows only ciphertext for sensitive fields. |
| **2 — Server data layer** | Postgres backend the browser app can migrate to; server can operate on data but a DB dump is useless. Envelope encryption via OpenBao, crypto-shred, RLS, append-only audit log. | Contract tests pass on Postgres; browser bundle imports to the server; `pg_dump` shows ciphertext; crypto-shred and cross-org RLS tests pass. |
| **3 — Kubernetes, Helm, IaC** | Helm chart that brings the stack up on `kind`; OpenTofu module for EKS that is validated, never applied. | `helm install` on kind works end-to-end through the Ingress with TLS; `helm lint` and `tofu validate` pass; `docs/infra.md` explains every component. |
| **4 — CI/CD and supply chain** | Every push tested, scanned, built, and deployed to a throwaway cluster in CI. Signed images with SBOMs. | A PR shows green checks for tests, scans, and the ephemeral deploy; a tag produces a signed release. |
| **5 — Migration CLI** | Generalize the browser→server migration into a standalone tool (`datamig`) other projects can use. | The CLI migrates an unrelated localStorage app to encrypted Postgres on kind, end-to-end, in under 15 minutes of user time. |
| **6 — Hardening** | Panic wipe, optional duress mode, external security review, self-hosting guide. | README complete; at least one external human review; one upstream contribution to a related project. |

Dependencies: 0 runs in parallel with 1; 2 needs 1; 3 needs 2; 4 needs 3; 5 needs 1–3; 6 needs
everything.
