# Developing Cadre

## Setup

Node version is pinned in [`.nvmrc`](../.nvmrc). With nvm: `nvm use`.

```sh
npm ci
```

## Commands

| Command              | Does                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server.                                              |
| `npm run build`      | Type-check (`vue-tsc --noEmit`) then build for production into `dist/`. |
| `npm test`           | Run the Vitest suite once.                                              |
| `npm run test:watch` | Run Vitest in watch mode.                                               |
| `npm run lint`       | ESLint over the project.                                                |
| `npm run typecheck`  | `vue-tsc --noEmit`, no build output.                                    |
| `npm run format`     | Prettier, writes to `src/`.                                             |

Acceptance check for a clean checkout:

```sh
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

## Test runner

Vitest runs against [`happy-dom`](https://github.com/capricorn86/happy-dom), configured in
[`vite.config.ts`](../vite.config.ts). That's enough for the Vue component tests this phase
adds (mounting components, asserting on rendered output) and is much faster to start than a
real browser.

PGlite turned out not to need anything more: `happy-dom` only shims DOM globals inside a real
Node process, and that process's own WASM support is what PGlite actually runs on, so
`src/storage/migrate.spec.ts` (added alongside `src/storage/migrate.ts`) runs under the default
config with no override.

WebCrypto-backed code is a separate question and still untested: `happy-dom` may not provide a
`SubtleCrypto` global the way a real browser or Node's own `crypto.webcrypto` does. If
`src/crypto/` specs hit that gap, route them through Vitest's
[browser mode](https://vitest.dev/guide/browser/) (`@vitest/browser`), which runs tests in a
real browser via Playwright/WebdriverIO. The two can coexist: keep `happy-dom` as the default
`test.environment` for UI specs, and give crypto specs a per-file `test.environment` override
(or a separate Vitest [project](https://vitest.dev/guide/projects.html)) that points at browser
mode. This phase doesn't add that config since nothing in `src/crypto/` exists yet — flagged
here so the issue that adds the first WebCrypto test doesn't have to rediscover it.

## Layout

- `src/app/` — Vue components. `App.vue` is the app root and currently _is_ the whole app: a
  static, public landing page (what Cadre is, who it's for, and how to run it). It has no
  store/repository access, no auth and collects nothing from visitors. Once real app views
  exist, this content moves behind routing rather than being replaced by it.
- `src/domain/` — types and the storage-repository interface.
- `src/storage/` — repository implementations (PGlite, Postgres).
- `src/crypto/` — thin wrappers around libsodium / WebCrypto / `age` / OpenBao transit only.

## Public site deployments

The brochure/landing site's production copy is `main` built by the GitHub Pages workflow —
that's the source of truth for what's publicly live.

Vercel is connected only for pull request previews: its GitHub integration builds each PR and
comments the preview URL, so brochure changes can be reviewed visually before merge. Vercel
deploys of `main` are disabled on purpose (`vercel.json`), so Vercel and GitHub Pages never both
claim to be "production" for the same branch. Preview builds carry the same scope limit as the
GitHub Pages build: only the brochure/landing content, not the functional ledger UI.

See [`docs/decisions/0004-public-site-hosting.md`](decisions/0004-public-site-hosting.md) for
the reasoning.
