# 0003 — Lint and format tooling

**Status:** accepted
**Date:** 2026-09-17

## Decision

Lint with ESLint (flat config, `typescript-eslint` + `eslint-plugin-vue`), format with
Prettier, wired together via `eslint-config-prettier` so the two never disagree about
formatting. TypeScript itself stays on the last 5.x line (`^5.9.3`) rather than the new
Go-ported TypeScript 7 line, because `typescript-eslint` and the rest of today's lint tooling
declare peer support only up to `<6.1.0`.

## Why, and what threat it addresses

Not a threat-model decision — this is project-hygiene tooling with no access to PII — but
AGENTS.md's rule 3 asks for a record of every real choice, and the issue itself named an
alternative (Biome). ESLint + Prettier was chosen over Biome because this project will soon
depend on `eslint-plugin-vue` for `<script setup>` SFC-aware rules and on `typescript-eslint`
for type-aware linting; Biome's Vue and type-aware-lint support is newer and less complete, and
this codebase leans on both. Losing Biome's single-binary speed is an acceptable tradeoff for a
project this size.

## Alternatives considered

- **Biome** — one dependency, much faster, but weaker Vue SFC and type-aware linting support
  today; would likely need a partial ESLint fallback anyway, defeating the simplification.
- **TypeScript 7 (`latest`)** — the new native/Go compiler; faster, but `typescript-eslint`
  8.x's declared peer range (`>=4.8.4 <6.1.0`) doesn't cover it yet, so `npm run lint` would be
  on an unsupported combination. Revisit once the lint toolchain declares TS 7 support.

## Consequences

Two dev dependencies (ESLint, Prettier) instead of one, and `eslint-config-prettier` must stay
in the ESLint config so formatting rules don't fight lint rules. The TypeScript version pin
needs revisiting (a follow-up decision record, not a silent bump) once `typescript-eslint`
declares support for the 6.x/7.x line — until then, bumping `typescript` past `6.1.0` will
break `npm run lint`.
