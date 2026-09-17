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

It is **not** enough once PGlite or WebCrypto-backed code needs tests: PGlite needs a real
WASM-capable runtime, and `happy-dom` doesn't implement `SubtleCrypto` or provide a WASM
environment sufficient for PGlite. When those land (`src/storage/`, `src/crypto/`), route
their spec files through Vitest's [browser mode](https://vitest.dev/guide/browser/)
(`@vitest/browser`) instead, which runs the tests in a real browser via Playwright/WebdriverIO.
The two can coexist: keep `happy-dom` as the default `test.environment` for UI specs, and give
storage/crypto specs a per-file `test.environment` override (or a separate Vitest
[project](https://vitest.dev/guide/projects.html)) that points at browser mode. This phase
doesn't add that config since nothing in `src/storage/` or `src/crypto/` exists yet — flagged
here so the issue that adds the first PGlite or WebCrypto test doesn't have to rediscover it.

## Layout

- `src/app/` — Vue components.
- `src/domain/` — types and the storage-repository interface.
- `src/storage/` — repository implementations (PGlite, Postgres).
- `src/crypto/` — thin wrappers around libsodium / WebCrypto / `age` / OpenBao transit only.
