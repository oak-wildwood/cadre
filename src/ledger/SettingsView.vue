<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { MIN_EXPORT_PASSPHRASE_LENGTH } from '../crypto/exportBundle'
import type { LedgerRepository } from '../domain/LedgerRepository'
import { toDateInput } from './dates'
import { errorMessage, exportMessage, importMessage } from './messages'

const props = defineProps<{ repository: LedgerRepository }>()
const emit = defineEmits<{ imported: [] }>()

// Default retention
// `v-model` on a number input hands back a number once something parses, so accept both.
const retentionDays = ref<string | number>('')
const retentionLoaded = ref(false)
const retentionStatus = ref<string | null>(null)
const retentionError = ref<string | null>(null)

onMounted(async () => {
  try {
    const days = await props.repository.getDefaultRetentionDays()
    retentionDays.value = days === null ? '' : String(days)
    retentionLoaded.value = true
  } catch (cause) {
    retentionError.value = errorMessage(cause)
  }
})

async function saveRetention(): Promise<void> {
  retentionStatus.value = null
  retentionError.value = null
  const raw = String(retentionDays.value).trim()
  const days = raw === '' ? null : Number(raw)
  if (days !== null && (!Number.isSafeInteger(days) || days < 1)) {
    retentionError.value = 'Enter a whole number of days, 1 or more, or leave it empty.'
    return
  }
  try {
    await props.repository.setDefaultRetentionDays(days)
    retentionStatus.value =
      days === null
        ? 'Saved. New members never expire unless you give them a date.'
        : `Saved. New members expire after ${days} days. Existing members keep their dates.`
  } catch (cause) {
    retentionError.value = errorMessage(cause)
  }
}

// Export
const exportPassphrase = ref('')
const exportConfirm = ref('')
const exporting = ref(false)
const exportStatus = ref<string | null>(null)
const exportError = ref<string | null>(null)

async function runExport(): Promise<void> {
  exportStatus.value = null
  exportError.value = null
  if (exportPassphrase.value.length < MIN_EXPORT_PASSPHRASE_LENGTH) {
    exportError.value = `Use at least ${MIN_EXPORT_PASSPHRASE_LENGTH} characters.`
    return
  }
  if (exportPassphrase.value !== exportConfirm.value) {
    exportError.value = "The two passphrases don't match."
    return
  }
  exporting.value = true
  try {
    const bundle = await props.repository.exportEncrypted({ passphrase: exportPassphrase.value })
    // The file name carries the date only: nothing about the org or its members.
    download(bundle, `cadre-export-${toDateInput(new Date())}.cadre`)
    exportStatus.value =
      'Export saved. It is encrypted with the export passphrase; keep that passphrase separately.'
  } catch (cause) {
    exportError.value = exportMessage(cause)
  } finally {
    exportPassphrase.value = ''
    exportConfirm.value = ''
    exporting.value = false
  }
}

function download(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'application/octet-stream' }),
  )
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  } finally {
    // Revoke on the next tick, once the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

// Import
const importFile = ref<File | null>(null)
const importPassphrase = ref('')
const importReplace = ref(false)
const importing = ref(false)
const importStatus = ref<string | null>(null)
const importError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile(event: Event): void {
  importFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function runImport(): Promise<void> {
  importStatus.value = null
  importError.value = null
  if (importFile.value === null) {
    importError.value = 'Choose an export file first.'
    return
  }
  importing.value = true
  try {
    const bundle = new Uint8Array(await importFile.value.arrayBuffer())
    const result = await props.repository.importEncrypted(bundle, {
      passphrase: importPassphrase.value,
      replace: importReplace.value,
    })
    importStatus.value =
      `Imported ${result.imported} ${result.imported === 1 ? 'member' : 'members'}.` +
      (result.skippedExpired ? ` Skipped ${result.skippedExpired} that had already expired.` : '')
    importFile.value = null
    importReplace.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    emit('imported')
  } catch (cause) {
    importError.value = importMessage(cause)
  } finally {
    importPassphrase.value = ''
    importing.value = false
  }
}
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h2 id="settings-heading" tabindex="-1">Settings</h2>

    <form novalidate @submit.prevent="saveRetention">
      <h3>Default retention</h3>
      <label for="retention-days">Delete new members after (days)</label>
      <input
        id="retention-days"
        v-model="retentionDays"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        aria-describedby="retention-hint"
        :disabled="!retentionLoaded"
      />
      <p id="retention-hint" class="hint">
        Leave empty for no default. Applies to members added from now on; existing members keep
        their expiry dates.
      </p>
      <p v-if="retentionError" class="error" role="alert">{{ retentionError }}</p>
      <p v-if="retentionStatus" role="status">{{ retentionStatus }}</p>
      <button type="submit" :disabled="!retentionLoaded">Save retention</button>
    </form>

    <form novalidate @submit.prevent="runExport">
      <h3>Export</h3>
      <p class="hint">
        Downloads every current member as one encrypted file. There is no plaintext export. Pick a
        passphrase for this file that is different from the ledger's.
      </p>
      <label for="export-passphrase">Export passphrase</label>
      <input
        id="export-passphrase"
        v-model="exportPassphrase"
        type="password"
        autocomplete="new-password"
        :disabled="exporting"
      />
      <label for="export-confirm">Type it again</label>
      <input
        id="export-confirm"
        v-model="exportConfirm"
        type="password"
        autocomplete="new-password"
        :disabled="exporting"
      />
      <p v-if="exportError" class="error" role="alert">{{ exportError }}</p>
      <p v-if="exporting" role="status">Encrypting… this takes a moment.</p>
      <p v-if="exportStatus" role="status">{{ exportStatus }}</p>
      <button type="submit" :disabled="exporting">Export</button>
    </form>

    <form novalidate @submit.prevent="runImport">
      <h3>Import</h3>
      <p class="hint">Restores members from a Cadre export file. Import never merges.</p>
      <label for="import-file">Export file</label>
      <input
        id="import-file"
        ref="fileInput"
        type="file"
        accept=".cadre,application/octet-stream"
        :disabled="importing"
        @change="pickFile"
      />
      <label for="import-passphrase">Export passphrase</label>
      <input
        id="import-passphrase"
        v-model="importPassphrase"
        type="password"
        autocomplete="off"
        :disabled="importing"
      />
      <label class="inline">
        <input v-model="importReplace" type="checkbox" :disabled="importing" />
        Replace all current members (deletes them first; can't be undone)
      </label>
      <p v-if="importError" class="error" role="alert">{{ importError }}</p>
      <p v-if="importing" role="status">Importing…</p>
      <p v-if="importStatus" role="status">{{ importStatus }}</p>
      <button type="submit" :disabled="importing">Import</button>
    </form>

    <section aria-labelledby="passphrase-heading">
      <h3 id="passphrase-heading">Change passphrase</h3>
      <p class="hint">
        Not available yet. Changing the passphrase has to re-encrypt every record under a new key
        (record 0007, decision 4), so it is tracked as its own follow-up.
      </p>
    </section>
  </section>
</template>

<style scoped>
form,
section > section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0 0 2rem;
}

input:not([type='checkbox']) {
  width: min(100%, 22rem);
}
</style>
