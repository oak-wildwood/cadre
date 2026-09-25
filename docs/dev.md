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

It is **not** enough once PGlite or WebCrypto-backed code needs tests: `happy-dom` doesn't
implement `SubtleCrypto` or provide a WASM environment sufficient for PGlite. PGlite itself is
isomorphic — the same WASM build runs under plain Node, not just a real browser — so the fix for
PGlite specs (`src/storage/migrate.spec.ts` is the first) is a per-file
[`// @vitest-environment node`](https://vitest.dev/guide/environment.html#test-environment)
docblock, not full browser mode: it opts that file out of `happy-dom` into Vitest's default
`node` environment, which has a real `WebAssembly` global and nothing else worth mentioning here.
Keep `happy-dom` as the default `test.environment` for UI specs; give storage specs (and any
other spec that just needs PGlite/WASM, no DOM) the same per-file override.

Reach for Vitest's [browser mode](https://vitest.dev/guide/browser/) (`@vitest/browser`,
real browser via Playwright/WebdriverIO) only when a test needs behavior the `node` environment
can't provide — e.g. a future PGlite adapter test that exercises IndexedDB-backed persistence,
or WebCrypto specifics that don't match Node's `globalThis.crypto.subtle`. Nothing in this phase
needs that yet, so `@vitest/browser` isn't added as a dependency here — flagged so the issue
that first needs it doesn't have to rediscover why.

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
