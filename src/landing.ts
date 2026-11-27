// Entry for index.html, the only page the production build bundles (record 0004).
// It mounts the static landing page and nothing that can touch a store. The ledger
// lives behind app.html -> main.ts, which only `npm run dev` serves.
import { createApp } from 'vue'

import './app/base.css'
import LandingPage from './app/LandingPage.vue'

createApp(LandingPage).mount('#app')
