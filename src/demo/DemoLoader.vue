<script setup lang="ts">
import { ref } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import { loadDemoRoster } from './loadDemoRoster'

const props = defineProps<{ repository: LedgerRepository }>()
const emit = defineEmits<{ loaded: [] }>()

const busy = ref(false)
const error = ref<string | null>(null)

async function load() {
  busy.value = true
  error.value = null
  try {
    await loadDemoRoster(props.repository)
    emit('loaded')
  } catch {
    // Not the error's text: it could carry a field value.
    error.value = 'Could not load the demo roster.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <p>
    <button type="button" class="btn" :disabled="busy" @click="load">Load demo roster</button>
    <span class="muted"> Twelve invented people for a fictional reporter. Local only.</span>
  </p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
</template>
