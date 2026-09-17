# 0004 — Public site hosting

**Status:** accepted
**Date:** 2026-09-17

## Decision

The public brochure/landing page is built on every push to `main` and published to
`https://oak-wildwood.github.io/cadre/` via GitHub Pages, serving the `gh-pages` branch. The
workflow (`.github/workflows/deploy.yml`) runs `npm ci`, typecheck, lint, `npm run build`,
marks the output with `dist/.nojekyll`, and pushes `dist/` to `gh-pages` with
`JamesIves/github-pages-deploy-action`. This mirrors the pattern already in use on `cairn`.
This decision covers hosting the brochure page only — see "What this does not cover" below.

## Why, and what threat it addresses

This is free, matches an already-proven pattern on a sibling project, and needs no new paid
service or infrastructure (`AGENTS.md` rule 4 rules out anything else). The content it serves
is a public brochure page: it reveals that this project exists and roughly how active it is,
which a public GitHub repository already reveals to anyone looking. It does not reveal member
data, so none of the threat model's rows (stolen device, legal compulsion, compromised server,
device seizure, insider access — see the README summary) apply to the page itself. Taking the
page down later, or losing the `gh-pages` branch, exposes nothing beyond what the already-public
repository exposes; there is no ratchet here that needs crypto-shredding or retention limits,
because there is no PII on this route.

## What this does not cover

This explicitly does not decide to publish the functional ledger UI (unlock, member list,
detail/edit, search, export/import). Cadre is self-hosted software, not a hosted service, and a
publicly reachable instance of the real app — with real or even demo membership data reachable
by anyone — is a materially different decision that needs its own decision record and explicit
sign-off, not something that rides in on a brochure-page deploy. Today `src/app/App.vue` is
still the pre-scaffold placeholder, so there is nothing app-shaped on this build to gate; once
the app has real routes, whichever change adds them must keep them out of the Pages build (a
separate entry point or an env flag), not rely on the brochure page simply not linking to them.

## Alternatives considered

- **Netlify / Vercel** — also free at this scale, but a new third-party account and DNS/build
  integration nobody has set up yet, for no benefit over Pages given `cairn`'s precedent.
- **A custom domain via GitHub Pages** — deferred; adds DNS to maintain for a brochure page
  with no current audience depending on a memorable URL.
- **No public site yet** — leaves the project with no discoverable public presence beyond the
  repo itself, which the follow-on landing-page issue exists specifically to fix.

## Consequences

Every push to `main` that changes `dist`-affecting files triggers a rebuild and republish;
a broken build blocks the deploy step rather than publishing stale or broken output. Enabling
GitHub Pages itself (Settings → Pages → source: `gh-pages` branch) is a one-time dashboard
step outside this PR — repository settings aren't reachable through the `gh api` scope
available to this change; see the PR description. Future work that adds real app routes to the
same Vite project must keep them out of this build's entry point, since nothing here enforces
that boundary beyond this record and the absence of app routes today.
