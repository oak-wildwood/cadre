<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import { MIN_EXPORT_PASSPHRASE_LENGTH } from '../crypto/exportBundle'
import type { LedgerStore, OpenLedger, StoreState } from '../domain/LedgerStore'
import { unlockMessage } from './messages'

const props = defineProps<{ store: LedgerStore }>()
const emit = defineEmits<{ unlocked: [ledger: OpenLedger] }>()

/** New stores use the same floor as export passphrases (record 0010, decision 3). */
const MIN_LENGTH = MIN_EXPORT_PASSPHRASE_LENGTH

const state = ref<StoreState | 'probing' | 'unavailable'>('probing')
const passphrase = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const isNew = computed(() => state.value === 'new')
const passphraseInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    state.value = await props.store.probe()
  } catch {
    state.value = 'unavailable'
  }
  await nextTick()
  passphraseInput.value?.focus()
})

async function submit(): Promise<void> {
  error.value = null
  if (isNew.value) {
    if (passphrase.value.length < MIN_LENGTH) {
      error.value = `Use at least ${MIN_LENGTH} characters. A few unrelated words work well.`
      return
    }
    if (passphrase.value !== confirm.value) {
      error.value = "The two passphrases don't match."
      return
    }
  }
  busy.value = true
  try {
    const entered = passphrase.value
    const ledger = isNew.value
      ? await props.store.create(entered)
      : await props.store.unlock(entered)
    emit('unlocked', ledger)
  } catch (cause) {
    error.value = unlockMessage(cause)
  } finally {
    // Don't keep the passphrase in component state any longer than the attempt.
    passphrase.value = ''
    confirm.value = ''
    busy.value = false
  }
  if (error.value) {
    await nextTick()
    passphraseInput.value?.focus()
  }
}
</script>

<template>
  <section class="unlock" aria-labelledby="unlock-heading">
    <h1 id="unlock-heading">Cadre</h1>
    <p v-if="state === 'probing'" role="status">Opening the store on this device…</p>
    <p v-else-if="state === 'unavailable'" role="alert">
      Could not open the store on this device. Storage may be blocked or full in this browser.
    </p>
    <form v-else novalidate @submit.prevent="submit">
      <template v-if="isNew">
        <h2>Set up this ledger</h2>
        <p class="warning">
          <strong>If you forget this passphrase, the data is gone.</strong> Nobody can reset it or
          recover it: not you, not the Cadre project, not anyone else. Write it down somewhere safe.
        </p>
      </template>
      <h2 v-else>Unlock</h2>

      <label for="passphrase">Passphrase</label>
      <input
        id="passphrase"
        ref="passphraseInput"
        v-model="passphrase"
        type="password"
        :autocomplete="isNew ? 'new-password' : 'current-password'"
        :aria-describedby="isNew ? 'passphrase-hint' : undefined"
        :disabled="busy"
        required
      />
      <p v-if="isNew" id="passphrase-hint" class="hint">At least {{ MIN_LENGTH }} characters.</p>

      <template v-if="isNew">
        <label for="confirm">Type it again</label>
        <input
          id="confirm"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          :disabled="busy"
          required
        />
      </template>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">{{ isNew ? 'Creating' : 'Unlocking' }}… this takes a moment.</p>

      <button type="submit" :disabled="busy">{{ isNew ? 'Create ledger' : 'Unlock' }}</button>
    </form>
  </section>
</template>

<style scoped>
.unlock {
  max-width: 26rem;
  margin: 4rem auto;
}

form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
}

button[type='submit'] {
  align-self: flex-start;
  margin-top: 0.5rem;
}

.warning {
  padding: 0.75rem;
  border-left: 3px solid var(--color-accent);
  background: var(--color-surface);
}
</style>
