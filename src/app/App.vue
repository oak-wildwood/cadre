<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import LandingPage from './LandingPage.vue'
import MemberForm from './MemberForm.vue'
import MemberList from './MemberList.vue'
import PurgeNotice from './PurgeNotice.vue'
import { createSession, type Session } from './session'
import SettingsView from './SettingsView.vue'
import UnlockView from './UnlockView.vue'

const props = defineProps<{ session?: Session }>()
const session = props.session ?? createSession()

type View = { name: 'list' } | { name: 'member'; id: string | null } | { name: 'settings' }
const view = ref<View>({ name: 'list' })
const about = ref(false)
const initError = ref(false)
const root = ref<HTMLElement | null>(null)

onMounted(() => {
  session.init().catch(() => (initError.value = true))
})
// Closing the tab is not a lock we can rely on, but at least stop the timer and drop the keys.
onUnmounted(() => void session.close())

// Move focus to the new screen's heading so keyboard and screen-reader users land on it.
watch(
  [view, () => session.unlocked.value, about],
  async () => {
    await nextTick()
    root.value?.querySelector<HTMLElement>('h1')?.focus()
  },
  { flush: 'post' },
)

async function lock() {
  await session.lock()
  view.value = { name: 'list' }
}
</script>

<template>
  <div ref="root" class="shell">
    <template v-if="session.unlocked.value && session.repository.value">
      <header class="row nav">
        <strong>Cadre</strong>
        <nav class="row grow" aria-label="Main">
          <button type="button" class="btn" @click="view = { name: 'list' }">Members</button>
          <button type="button" class="btn" @click="view = { name: 'settings' }">Settings</button>
        </nav>
        <button type="button" class="btn" @click="lock">Lock</button>
      </header>
      <MemberList
        v-if="view.name === 'list'"
        :repository="session.repository.value"
        :data-version="session.dataVersion.value"
        @open="(id) => (view = { name: 'member', id })"
        @add="view = { name: 'member', id: null }"
      />
      <MemberForm
        v-else-if="view.name === 'member'"
        :key="view.id ?? 'new'"
        :repository="session.repository.value"
        :member-id="view.id"
        @saved="view = { name: 'list' }"
        @deleted="view = { name: 'list' }"
        @cancel="view = { name: 'list' }"
      />
      <SettingsView
        v-else
        :repository="session.repository.value"
        @imported="view = { name: 'list' }"
      />
      <PurgeNotice
        :purged="session.retention.notice.value"
        @dismiss="session.retention.dismiss()"
      />
    </template>
    <template v-else-if="about">
      <LandingPage />
      <p class="narrow"><button type="button" class="link" @click="about = false">Back</button></p>
    </template>
    <p v-else-if="initError" class="narrow error" role="alert">Could not open the local store.</p>
    <p v-else-if="session.hasStore.value === null" class="narrow" role="status">Loading…</p>
    <UnlockView
      v-else
      :has-store="session.hasStore.value"
      :busy="session.busy.value"
      :error="session.error.value"
      @submit="(p) => (session.hasStore.value ? session.unlock(p) : session.create(p))"
      @about="about = true"
    />
  </div>
</template>

<style>
/* Unscoped on purpose: these tokens, resets and shared control styles are the whole app's
   (landing page and ledger screens alike). A later design pass can promote this block to its own
   stylesheet without changing the values. */
:root {
  --color-bg: #0b1220;
  --color-fg: #eef2f8;
  --color-fg-muted: #9aa8c7;
  --color-accent: #e7b654;
  --color-accent-strong: #f5c97a;
  --color-border: #23304d;
}

html {
  color-scheme: dark;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-fg);
}

::selection {
  background: var(--color-accent);
  color: var(--color-bg);
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

* {
  scrollbar-color: var(--color-border) var(--color-bg);
}

::-webkit-scrollbar {
  width: 12px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 999px;
  border: 3px solid var(--color-bg);
}

.narrow {
  max-width: 28rem;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

.shell main,
.shell > section {
  max-width: 52rem;
}

.field {
  display: block;
  margin: 0 0 1rem;
  border: 0;
  padding: 0;
}

.field > span,
legend {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-fg-muted);
}

input[type='text'],
input[type='password'],
input[type='email'],
input[type='tel'],
input[type='date'],
input[type='search'],
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-fg);
  font: inherit;
}

.btn {
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-fg);
  font: inherit;
  cursor: pointer;
}

.btn.primary {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-bg);
}

.btn.danger {
  border-color: #e5484d;
  color: #ff8589;
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}

.grow {
  flex: 1;
}

.inline {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.muted {
  color: var(--color-fg-muted);
  font-size: 0.875rem;
}

.error {
  color: #ff8589;
}

.badge {
  margin-left: 0.25rem;
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  color: var(--color-accent);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.callout {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid #e5484d;
  border-radius: 0.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

table {
  width: 100%;
  margin-bottom: 1rem;
  border-collapse: collapse;
}

th,
td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
</style>
