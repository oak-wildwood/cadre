<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'

import type { LedgerStore, OpenLedger } from '../domain/LedgerStore'
import type { MemberId } from '../domain/member'
import PurgeNotice from '../app/PurgeNotice.vue'
import { useRetention, type Retention } from '../app/retention'
import MemberForm from './MemberForm.vue'
import MemberList from './MemberList.vue'
import SettingsView from './SettingsView.vue'
import UnlockView from './UnlockView.vue'

const props = defineProps<{ store: LedgerStore }>()

type View = { name: 'list' } | { name: 'member'; id: MemberId | null } | { name: 'settings' }

// Plain in-memory view state, no router: nothing about a member ever reaches the URL or history.
const ledger = shallowRef<OpenLedger | null>(null)
const retention = shallowRef<Retention | null>(null)
const view = ref<View>({ name: 'list' })
/** Bumped to remount the list after a purge or import changed what it shows. */
const listKey = ref(0)
const main = ref<HTMLElement | null>(null)

async function onUnlocked(opened: OpenLedger): Promise<void> {
  ledger.value = opened
  view.value = { name: 'list' }
  const purge = useRetention({
    repository: opened.repository,
    onPurged: () => {
      if (view.value.name === 'list') {
        listKey.value++
      }
    },
  })
  retention.value = purge
  await purge.start()
}

async function lock(): Promise<void> {
  const opened = ledger.value
  retention.value?.stop()
  retention.value = null
  // Drop the views first so no component keeps decrypted members around.
  ledger.value = null
  view.value = { name: 'list' }
  await opened?.lock()
}

async function go(next: View): Promise<void> {
  view.value = next
  if (next.name === 'list') {
    listKey.value++
  }
  await nextTick()
  // Move focus to the new view's heading so keyboard and screen-reader users land in it.
  main.value?.querySelector<HTMLElement>('h2')?.focus()
}

onBeforeUnmount(() => {
  void lock()
})
</script>

<template>
  <div class="ledger">
    <UnlockView v-if="!ledger" :store="props.store" @unlocked="onUnlocked" />
    <template v-else>
      <header class="shell">
        <span class="brand">Cadre</span>
        <nav aria-label="Ledger">
          <button
            type="button"
            :aria-current="view.name === 'list' ? 'page' : undefined"
            @click="go({ name: 'list' })"
          >
            Members
          </button>
          <button
            type="button"
            :aria-current="view.name === 'settings' ? 'page' : undefined"
            @click="go({ name: 'settings' })"
          >
            Settings
          </button>
        </nav>
        <button type="button" class="lock" @click="lock">Lock</button>
      </header>

      <main ref="main">
        <MemberList
          v-if="view.name === 'list'"
          :key="listKey"
          :repository="ledger.repository"
          @open="(id) => go({ name: 'member', id })"
          @add="go({ name: 'member', id: null })"
        />
        <MemberForm
          v-else-if="view.name === 'member'"
          :key="view.id ?? 'new'"
          :repository="ledger.repository"
          :member-id="view.id"
          @saved="go({ name: 'list' })"
          @deleted="go({ name: 'list' })"
          @cancel="go({ name: 'list' })"
        />
        <SettingsView v-else :repository="ledger.repository" @imported="listKey++" />
      </main>

      <PurgeNotice
        v-if="retention"
        :purged="retention.notice.value"
        @dismiss="retention.dismiss()"
      />
    </template>
  </div>
</template>

<style>
/* Unscoped: the ledger page's tokens and base styles. Same palette as the landing page. */
:root {
  --color-bg: #0b1220;
  --color-surface: #131c30;
  --color-fg: #eef2f8;
  --color-fg-muted: #9aa8c7;
  --color-accent: #e7b654;
  --color-border: #23304d;
  --color-danger: #ff8a80;
  color-scheme: dark;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif;
  line-height: 1.5;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

input,
select,
textarea,
button {
  font: inherit;
  color: inherit;
}

input,
select,
textarea {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-surface);
}

button {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-surface);
  cursor: pointer;
}

button:disabled {
  cursor: progress;
  opacity: 0.6;
}

button.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  text-decoration: underline;
  text-align: left;
}

button.danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.hint {
  margin: 0;
  color: var(--color-fg-muted);
  font-size: 0.875rem;
}

.error {
  color: var(--color-danger);
}

.badge {
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border: 1px solid var(--color-accent);
  border-radius: 0.25rem;
  color: var(--color-accent);
  font-size: 0.75rem;
  vertical-align: middle;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

label.inline {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
</style>

<style scoped>
.ledger {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1rem 1rem 4rem;
}

.shell {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-weight: 800;
}

nav {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

nav button[aria-current='page'] {
  border-color: var(--color-accent);
}
</style>
