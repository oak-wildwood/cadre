# 0004 — Public site hosting

**Status:** accepted
**Date:** 2026-09-17

## Decision

The public brochure/landing page is built on every push to `main` and published to
`https://oak-wildwood.github.io/cadre/` via GitHub Pages' native Actions-based deployment
(Settings → Pages → source: "GitHub Actions", not a `gh-pages` branch). The workflow
(`.github/workflows/deploy.yml`) runs `npm ci`, typecheck, lint, `npm run build`, then
`actions/upload-pages-artifact` and `actions/deploy-pages`. `cairn`'s existing Pages setup uses
the older branch-deploy pattern (`JamesIves/github-pages-deploy-action` pushing to `gh-pages`)
rather than this one; the two aren't required to match, and native was chosen here since it's
GitHub's current recommended default and this project treats GitHub Pages itself as a prototype
stage ahead of a real production domain.

Vercel's GitHub integration is connected only for pull request preview deployments: it builds
each PR and comments the preview URL, but `main` deploys are disabled in `vercel.json`
(`git.deploymentEnabled.main: false`) so Vercel never also claims to be production. GitHub Pages
stays the single source of truth for what's live. In both GitHub Pages and Vercel previews, only
the brochure/landing content is reachable — never the functional ledger UI — until a later phase
decides otherwise. This decision covers hosting the brochure page only — see "What this does not
cover" below.

## Why, and what threat it addresses

This is free and needs no new paid service or infrastructure (`AGENTS.md` rule 4 rules out
anything else). The content it serves is a public brochure page: it reveals that this project
exists and roughly how active it is, which a public GitHub repository already reveals to anyone
looking. It does not reveal member data, so none of the threat model's rows (stolen device,
legal compulsion, compromised server, device seizure, insider access — see the README summary)
apply to the page itself. Taking the page down later exposes nothing beyond what the
already-public repository exposes; there is no ratchet here that needs crypto-shredding or
retention limits, because there is no PII on this route.

The same "minimize what any third party can reach or hold" instinct behind the threat model's
"compromised server" and "legal compulsion" rows still applies to hosting choices, even though
those rows are about the ledger and not the marketing site. Two services both able to serve
`main` as "production" is a split-brain risk: someone could land a change that only propagates
on one of them, or later mistake a stale Vercel deploy for the canonical one. Pinning GitHub
Pages as the only production target and Vercel to preview-only removes that ambiguity outright.
Restricting both to brochure-only content is the same reasoning as rule 2 (don't keep what you
can't protect): neither a GitHub Pages build nor a third-party build service (Vercel, a paid
platform used here only for its free preview tier) should ever have the ledger UI, real member
data, or real-looking fixtures pass through it.

## What this does not cover

This explicitly does not decide to publish the functional ledger UI (unlock, member list,
detail/edit, search, export/import). Cadre is self-hosted software, not a hosted service, and a
publicly reachable instance of the real app — with real or even demo membership data reachable
by anyone — is a materially different decision that needs its own decision record and explicit
sign-off, not something that rides in on a brochure-page deploy. `src/app/App.vue` is the real
brochure/landing page now (issue #27), still nothing app-shaped; once the app gains real routes,
whichever change adds them must keep them out of the Pages build (a separate entry point or an
env flag), not rely on the brochure page simply not linking to them. If the ledger UI is ever
exposed in preview or Pages builds, that's a new architectural choice and needs its own decision
record rather than a silent scope change here.

## Alternatives considered

- **The branch-deploy pattern `cairn` uses** (`JamesIves/github-pages-deploy-action` pushing to
  a `gh-pages` branch) — still fully supported and not wrong, just the older of two valid
  patterns. Chosen against here because native needs no third-party action and leaves no
  `gh-pages` branch to clean up if/when this moves to real production hosting.
- **Vercel for production too, GitHub Pages dropped** — rejected; keeps the public site's
  source of truth off a paid third-party platform's production tier and out of scope for
  billing decisions (rule 4: free and open source only).
- **Vercel previews and production both enabled** — rejected; two systems both able to claim
  "production" for `main` is the split-brain problem this decision exists to avoid.
- **No PR previews at all** — rejected; loses the ability to visually review brochure content
  changes before merge, which is the whole benefit of the Vercel integration.
- **Netlify or another preview provider** — no strong reason to prefer it here; Vercel was
  chosen to mirror the existing `cairn` project's setup rather than introduce a third pattern.
- **A custom domain via GitHub Pages** — deferred; adds DNS to maintain for a brochure page
  with no current audience depending on a memorable URL.
- **No public site yet** — leaves the project with no discoverable public presence beyond the
  repo itself, which the follow-on landing-page issue exists specifically to fix.

## Consequences

Every push to `main` that changes `dist`-affecting files triggers a rebuild and republish; a
broken build blocks the deploy step rather than publishing stale or broken output. Pull requests
that touch the brochure/landing content get an automatic Vercel preview comment; `main` stays
exclusively served by the GitHub Pages workflow. Enabling GitHub Pages itself (Settings → Pages
→ source: "GitHub Actions") and connecting the repository to a Vercel project (dashboard, or
`vercel link`) are both one-time manual steps outside the reach of the `gh api` scope available
to these changes — tracked separately as human tasks. Future work that adds real app routes to
the same Vite project must keep them out of both builds' entry point, since nothing here
enforces that boundary beyond this record and the absence of app routes today.
