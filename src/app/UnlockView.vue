<script setup lang="ts">
import { computed, ref } from 'vue'

import { MIN_STORE_PASSPHRASE_LENGTH } from './session'

const props = defineProps<{ hasStore: boolean; busy: boolean; error: string | null }>()
const emit = defineEmits<{ submit: [passphrase: string]; about: [] }>()

const passphrase = ref('')
const confirm = ref('')
const localError = ref<string | null>(null)
const shown = computed(() => localError.value ?? props.error)

function onSubmit() {
  localError.value = null
  if (!props.hasStore) {
    if ([...passphrase.value.normalize('NFC')].length < MIN_STORE_PASSPHRASE_LENGTH) {
      localError.value = `Use at least ${MIN_STORE_PASSPHRASE_LENGTH} characters.`
      return
    }
    if (passphrase.value !== confirm.value) {
      localError.value = 'The two passphrases do not match.'
      return
    }
  }
  const value = passphrase.value
  // Clear the fields now: the value lives on only in the call, not in the DOM or component state.
  passphrase.value = ''
  confirm.value = ''
  emit('submit', value)
}
</script>

<template>
  <main class="narrow">
    <h1 tabindex="-1">{{ hasStore ? 'Unlock Cadre' : 'Create your ledger' }}</h1>
    <p v-if="!hasStore" class="muted">
      This ledger is encrypted with a passphrase only you hold. There is no recovery: if it is
      forgotten, the data is gone. Use at least {{ MIN_STORE_PASSPHRASE_LENGTH }} characters.
    </p>
    <form @submit.prevent="onSubmit">
      <label class="field">
        <span>Passphrase</span>
        <input
          v-model="passphrase"
          type="password"
          :autocomplete="hasStore ? 'current-password' : 'new-password'"
          required
          autofocus
        />
      </label>
      <label v-if="!hasStore" class="field">
        <span>Confirm passphrase</span>
        <input v-model="confirm" type="password" autocomplete="new-password" required />
      </label>
      <p v-if="shown" class="error" role="alert">{{ shown }}</p>
      <button type="submit" class="btn primary" :disabled="busy">
        {{ busy ? 'Working…' : hasStore ? 'Unlock' : 'Create ledger' }}
      </button>
    </form>
    <p><button type="button" class="link" @click="emit('about')">About Cadre</button></p>
  </main>
</template>
