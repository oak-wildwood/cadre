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

- `src/app/` — the public landing page (`App.vue`, entry `index.html` → `src/main.ts`). Static:
  no store access, no auth, collects nothing from visitors. Also holds the retention timer
  (`retention.ts`) and `PurgeNotice.vue`, which the ledger uses.
- `src/ledger/` — the ledger UI (entry `app.html` → `src/ledger/main.ts`): unlock, member list and
  search, add/edit, settings, export/import. See "The ledger UI" below.
- `src/domain/` — types, the storage-repository interface and `LedgerStore` (create, unlock,
  lock).
- `src/storage/` — repository implementations (PGlite, Postgres).
- `src/crypto/` — Cadre glue around `keyslot`: member fields to ciphertext and back.
- `packages/keyslot/` — the standalone key-slot and field-encryption package (npm workspace,
  Apache-2.0). It imports nothing from `src/`.

## The ledger UI

Run `npm run dev` and open <http://localhost:5173/app.html>. The first visit creates a store and
asks for its passphrase twice; later visits unlock it. **Lock** drops the keys from memory and
closes the store.

- **Only in development for now.** `app.html` is its own Vite entry, and `npm run build` bundles
  `index.html` only, so the ledger never reaches the GitHub Pages or Vercel preview builds
  (record 0004). `src/ledger/buildIsolation.spec.ts` runs a real production build and fails if
  any of the ledger ends up in it. Building the ledger for self-hosting is later work.
- **Storage access.** Components get a `LedgerStore` (`src/domain/LedgerStore.ts`, implemented by
  `src/storage/PGliteStore.ts`) to create or unlock the store, and from then on talk only to the
  `LedgerRepository` it hands back (AGENTS.md rule 5).
- **No PII outside memory.** There is no router: which screen and which member are open is
  in-memory state, so nothing reaches the URL or history. The UI writes nothing to
  `localStorage`, `sessionStorage` or cookies, and never logs. Error messages are fixed strings
  chosen by error class; an error's own text is never shown. Member inputs have
  `autocomplete="off"`. After a run, DevTools → Application should show only the
  `/pglite/cadre` IndexedDB database (ciphertext, see below) and empty Local and Session storage.
- **Unlock errors** read the same for a wrong passphrase, a damaged store and a missing one
  (record 0007, decision 8). Only "this device can't run the encryption" is reported apart.
- **Search** is exact match on name or email through the blind index (record 0008); the search
  box says so.
- **Retention.** Unlocking runs `purgeExpired` and starts the hourly timer; the form pre-fills
  `expires_at` from the org default and stores it as the end of the chosen local day.
- **Not done yet:** changing the passphrase (#65, it must rotate the key, record 0007 decision
  4); running Argon2id in a Web Worker, so the page stays responsive during the second or so
  unlock takes; masking email and phone until revealed.

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
