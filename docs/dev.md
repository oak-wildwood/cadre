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

It is **not** enough for every `src/storage/`/`src/crypto/` spec: `happy-dom` doesn't implement
`SubtleCrypto`, so anything exercising WebCrypto still needs a real browser via Vitest's
[browser mode](https://vitest.dev/guide/browser/) (`@vitest/browser`, Playwright/WebdriverIO).
PGlite turned out not to need that — it's plain WASM, which Node's own runtime already supports,
so `migrate.spec.ts` overrides just that file's environment to plain `node` with a
`// @vitest-environment node` comment rather than pulling in a browser runner. The two
`test.environment` overrides can coexist per spec file (or as separate Vitest
[projects](https://vitest.dev/guide/projects.html)): `node` for WASM-only code like the
migration runner, browser mode reserved for whichever `src/crypto/` spec is the first to need
`SubtleCrypto`.

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
