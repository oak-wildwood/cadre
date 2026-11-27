<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref, watch } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member } from '../domain/member'
import { formatDate } from './dates'

const props = defineProps<{ repository: LedgerRepository; dataVersion: number }>()
const emit = defineEmits<{ open: [id: string]; add: [] }>()

const PAGE = 25
const members = ref<Member[]>([])
const nextCursor = ref<string | null>(null)
const query = ref('')
const searched = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
// The demo loader is dev-only. `import.meta.env.DEV` is a build-time constant, so a production
// build folds this to `null` and drops the loader and the roster with it (record 0004).
const DemoLoader = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../demo/DemoLoader.vue'))
  : null

let latest = 0

async function load(more = false) {
  const token = ++latest
  loading.value = true
  error.value = null
  try {
    if (searched.value) {
      // Equality-only lookups on the blind indexes (docs/decisions/0008): name, then email.
      const [byName, byEmail] = await Promise.all([
        props.repository.findByBlindIndex('displayName', searched.value),
        props.repository.findByBlindIndex('email', searched.value),
      ])
      const seen = new Set<string>()
      if (token !== latest) return
      members.value = [...byName, ...byEmail].filter((m) => !seen.has(m.id) && seen.add(m.id))
      nextCursor.value = null
    } else {
      const page = await props.repository.list({
        limit: PAGE,
        orderBy: 'createdAt',
        orderDirection: 'desc',
        cursor: more ? nextCursor.value : null,
      })
      if (token !== latest) return
      members.value = more ? [...members.value, ...page.items] : page.items
      nextCursor.value = page.nextCursor
    }
  } catch {
    if (token === latest) error.value = 'Could not load members.'
  } finally {
    if (token === latest) loading.value = false
  }
}

function onSearch() {
  searched.value = query.value.trim() || null
  void load()
}

function clear() {
  query.value = ''
  searched.value = null
  void load()
}

onMounted(() => load())
watch(
  () => props.dataVersion,
  () => load(),
)
</script>

<template>
  <section>
    <h1 tabindex="-1">Members</h1>
    <div class="row">
      <form class="row grow" role="search" @submit.prevent="onSearch">
        <label class="grow">
          <span class="sr-only">Search members</span>
          <input
            v-model="query"
            type="search"
            placeholder="Exact name or email (full match only)"
            autocomplete="off"
          />
        </label>
        <button type="submit" class="btn">Search</button>
        <button v-if="searched" type="button" class="btn" @click="clear">Clear</button>
      </form>
      <button type="button" class="btn primary" @click="emit('add')">Add member</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !members.length" role="status">Loading…</p>
    <p v-else-if="!members.length" role="status">
      {{ searched ? 'No exact match.' : 'No members yet.' }}
    </p>
    <table v-else>
      <caption class="sr-only">
        Members
      </caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Role</th>
          <th scope="col">Expires</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.id">
          <td>
            <button type="button" class="link" @click="emit('open', member.id)">
              {{ member.displayName }}
            </button>
          </td>
          <td>{{ member.role ?? '' }}</td>
          <td>{{ formatDate(member.expiresAt) }}</td>
          <td>{{ formatDate(member.updatedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <DemoLoader
      v-if="DemoLoader && !searched && !loading && !members.length && !error"
      :repository="repository"
      @loaded="load()"
    />
    <button v-if="nextCursor" type="button" class="btn" :disabled="loading" @click="load(true)">
      Load more
    </button>
  </section>
</template>
