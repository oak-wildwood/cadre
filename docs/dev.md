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

Specs that use WebCrypto (`src/crypto/`, `packages/keyslot/`) run in Node instead, opted in
per file with a `// @vitest-environment node` comment on the first line. Node 22 ships the same
WebCrypto API and runs libsodium's and PGlite's WebAssembly. A real
browser run (Vitest [browser mode](https://vitest.dev/guide/browser/)) is still worth adding
before release, since Argon2id memory limits differ per browser and device (#53).

Most crypto specs use the cheaper "interactive" Argon2id settings (`MIN_KDF_PARAMS`) to stay
fast. The defaults themselves are exercised once, in `packages/keyslot/test/params.spec.ts`.

## Layout

- `src/app/` — Vue components. `App.vue` is the app root and currently _is_ the whole app: a
  static, public landing page (what Cadre is, who it's for, and how to run it). It has no
  store/repository access, no auth and collects nothing from visitors. Once real app views
  exist, this content moves behind routing rather than being replaced by it.
- `src/domain/` — types and the storage-repository interface.
- `src/storage/` — repository implementations (PGlite, Postgres).
- `src/crypto/` — Cadre glue around `keyslot`: member fields to ciphertext and back.
- `packages/keyslot/` — the standalone key-slot and field-encryption package (npm workspace,
  Apache-2.0). It imports nothing from `src/`.

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
