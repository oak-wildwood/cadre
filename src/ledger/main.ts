/**
 * Entry point for the ledger UI, served from `app.html`. Deliberately separate from the public
 * landing page (`index.html`, `src/main.ts`): `npm run build` only bundles `index.html`, so the
 * ledger never reaches the GitHub Pages or Vercel preview builds (record 0004). Run it with
 * `npm run dev` and open `/app.html`.
 */
import { createApp } from 'vue'

import { PGliteStore } from '../storage/PGliteStore'
import LedgerApp from './LedgerApp.vue'

createApp(LedgerApp, { store: new PGliteStore() }).mount('#app')
