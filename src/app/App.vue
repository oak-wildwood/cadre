<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import './base.css'
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
