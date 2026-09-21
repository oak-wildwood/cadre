# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, if it exists.
- **`docs/decisions/`**: read decision records that touch the area you're about to work in. This
  repo's convention (see `docs/decisions/README.md`) is used instead of the skill's generic
  `docs/adr/` default — don't create a `docs/adr/` folder. The template and "write one only when
  it's hard to reverse, surprising, and a real trade-off" test in `docs/decisions/README.md`
  mirror `domain-modeling`'s own `ADR-FORMAT.md`, so no translation is needed between the two.

If `CONTEXT.md` doesn't exist yet, **proceed silently**. Don't flag its absence; don't suggest
creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs`) creates it
lazily when terms actually get resolved.

## File structure

Single-context (this repo):

```
/
├── CONTEXT.md              ← created lazily by /domain-modeling
├── docs/decisions/
│   ├── 0002-license.md
│   ├── 0003-lint-and-format-tooling.md
│   └── ...
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis,
a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary
explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

## Flag decision-record conflicts

If your output contradicts an existing decision record, surface it explicitly rather than
silently overriding:

> _Contradicts `docs/decisions/0004-public-site-hosting.md`, but worth reopening because…_
