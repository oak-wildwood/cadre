# Developing Cadre

## Setup

Node version is pinned in [`.nvmrc`](../.nvmrc). With nvm: `nvm use`.

```sh
npm ci
```

## Commands

| Command              | Does                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server.                                                       |
| `npm run build`      | Type-check (`npm run typecheck`) then build for production into `dist/`.         |
| `npm test`           | Run the Vitest suite once.                                                       |
| `npm run test:watch` | Run Vitest in watch mode.                                                        |
| `npm run lint`       | ESLint over the project.                                                         |
| `npm run typecheck`  | `vue-tsc --noEmit` on the app, the specs plus Node-only files, and root configs. |
| `npm run format`     | Prettier, writes to `src/`.                                                      |

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

- `src/app/` — Vue components. `App.vue` is the shell: Unlock (creates the store on first run),
  Members (list and exact-match search), Add/Edit member, Settings (default retention, encrypted
  export, import with a replace confirmation) and a Lock button. `LandingPage.vue` is the
  static public page, reachable from the Unlock screen. `session.ts` owns the unlock lifecycle:
  it reads the key slot (`src/storage/keySlotStore.ts`), unlocks, builds the `PGliteRepository`,
  starts retention (`retention.ts`) and, on lock, closes the database and wipes the key ring.
  Views get a `LedgerRepository` and nothing else (AGENTS.md rule 5). No view logs, uses route
  params, or writes to `localStorage`/`sessionStorage`; screens are state-based, not routed, so a
  member's id never reaches the URL. Not built yet: changing the ledger passphrase, and
  masked-by-default phone/email.
- `src/domain/` — types and the storage-repository interface.
- `src/storage/` — repository implementations (PGlite, Postgres).
- `src/crypto/` — Cadre glue around `keyslot`: member fields to ciphertext and back.
- `packages/keyslot/` — the standalone key-slot and field-encryption package (npm workspace,
  Apache-2.0). It imports nothing from `src/`.

## The browser store

`PGliteRepository` (`src/storage/`) keeps the ledger in PGlite, persisted to **IndexedDB** at
`idb://cadre` by default. Why IndexedDB rather than OPFS: PGlite's OPFS backend (`opfs-ahp://`)
must run inside a Web Worker and holds synchronous access handles that Safari limits, while
IndexedDB works on the main thread in every browser Cadre targets. Switching later is a copy of
the data directory (`dumpDataDir` / `loadDataDir`) or an export and import, so this is not a
decision record. Migrations run each time the store opens.

To inspect it: DevTools → Application → Storage → IndexedDB → `/pglite/cadre` → `FILE_DATA`.
Each entry is one Postgres data file, as raw bytes. Sensitive fields are only ever written as
`*_enc` ciphertext and `*_bidx` HMACs, so no member name, email, phone, role or note should be
findable there (`src/crypto/storeDump.spec.ts` automates that check on a raw dump). To see the
rows themselves, query the store from a test or a scratch script with
`new PGlite('idb://cadre')`; never paste real member data into an issue.

Deleting or purging a member runs `VACUUM FULL members`, then retires the write-ahead log
(`wal_recycle` off, `pg_switch_wal()`, `CHECKPOINT`), so the row's ciphertext leaves both the
table's data files and the WAL at once (tested against in-memory PGlite; the browser's IndexedDB
layer underneath may keep residue until it compacts). The data key is still the store's key,
so this is not yet per-record crypto-shredding. See `docs/retention.md`.

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
