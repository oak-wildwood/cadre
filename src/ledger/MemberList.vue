<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member, MemberId } from '../domain/member'
import { formatDate } from './dates'
import { errorMessage } from './messages'

const props = defineProps<{ repository: LedgerRepository }>()
defineEmits<{ open: [id: MemberId]; add: [] }>()

const PAGE_SIZE = 50
const SEARCH_FIELDS = [
  { value: 'displayName', label: 'Name' },
  { value: 'email', label: 'Email' },
] as const
type SearchField = (typeof SEARCH_FIELDS)[number]['value']

const members = ref<Member[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const searchField = ref<SearchField>('displayName')
const searchValue = ref('')
/** Set while showing search results; the term itself is not kept after the search runs. */
const searching = ref(false)

async function loadPage(cursor: string | null): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await props.repository.list({
      limit: PAGE_SIZE,
      cursor,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    })
    members.value = cursor === null ? page.items : [...members.value, ...page.items]
    nextCursor.value = page.nextCursor
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function search(): Promise<void> {
  if (searchValue.value.trim() === '') {
    return clearSearch()
  }
  loading.value = true
  error.value = null
  try {
    members.value = await props.repository.findByBlindIndex(searchField.value, searchValue.value)
    nextCursor.value = null
    searching.value = true
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function clearSearch(): Promise<void> {
  searchValue.value = ''
  searching.value = false
  await loadPage(null)
}

onMounted(() => loadPage(null))
</script>

<template>
  <section aria-labelledby="list-heading">
    <div class="heading-row">
      <h2 id="list-heading" tabindex="-1">Members</h2>
      <button type="button" @click="$emit('add')">Add member</button>
    </div>

    <form class="search" role="search" @submit.prevent="search">
      <label for="search-field">Search by</label>
      <select id="search-field" v-model="searchField">
        <option v-for="field in SEARCH_FIELDS" :key="field.value" :value="field.value">
          {{ field.label }}
        </option>
      </select>
      <label for="search-value" class="visually-hidden">Search value</label>
      <input
        id="search-value"
        v-model="searchValue"
        type="search"
        autocomplete="off"
        placeholder="Exact match only, e.g. a full email address"
        aria-describedby="search-hint"
      />
      <button type="submit">Search</button>
      <button v-if="searching" type="button" @click="clearSearch">Show all</button>
      <p id="search-hint" class="hint">
        Search matches the whole name or email exactly (ignoring case and extra spaces). Parts of a
        name won't match: the data is encrypted, and partial search would leak it.
      </p>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Loading…</p>
    <p v-else-if="members.length === 0" role="status">
      {{ searching ? 'No member matches exactly.' : 'No members yet.' }}
    </p>

    <table v-if="members.length">
      <caption class="visually-hidden">
        {{
          searching ? 'Search results' : 'All members, newest first'
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Added</th>
          <th scope="col">Expires</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.id">
          <td>
            <button type="button" class="link" @click="$emit('open', member.id)">
              {{ member.displayName }}
            </button>
          </td>
          <td>{{ formatDate(member.createdAt) }}</td>
          <td>{{ formatDate(member.expiresAt) }}</td>
        </tr>
      </tbody>
    </table>

    <button v-if="nextCursor && !loading" type="button" @click="loadPage(nextCursor)">
      Load more
    </button>
  </section>
</template>

<style scoped>
.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
}

.search input {
  flex: 1 1 16rem;
}

.search .hint {
  flex-basis: 100%;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
</style>
