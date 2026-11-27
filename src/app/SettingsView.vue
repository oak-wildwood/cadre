<script setup lang="ts">
import { DecryptError, UnlockError, UnsupportedFormatError } from 'keyslot'
import { onMounted, ref } from 'vue'

import {
  BundleFormatError,
  ExportPassphraseTooShortError,
  MIN_EXPORT_PASSPHRASE_LENGTH,
} from '../crypto/exportBundle'
import { StoreNotEmptyError, type LedgerRepository } from '../domain/LedgerRepository'
import { toDateInput } from './dates'

const props = defineProps<{ repository: LedgerRepository }>()
const emit = defineEmits<{ imported: [] }>()

// Retention
const days = ref('')
const retentionMsg = ref<string | null>(null)
const retentionErr = ref<string | null>(null)

onMounted(async () => {
  try {
    const current = await props.repository.getDefaultRetentionDays()
    days.value = current === null ? '' : String(current)
  } catch {
    retentionErr.value = 'Could not load the current setting.'
  }
})

async function saveRetention() {
  retentionMsg.value = retentionErr.value = null
  const text = days.value.trim()
  const value = text === '' ? null : Number(text)
  if (value !== null && (!Number.isSafeInteger(value) || value < 1)) {
    retentionErr.value = 'Use a whole number of days, or leave blank for no default.'
    return
  }
  try {
    await props.repository.setDefaultRetentionDays(value)
    retentionMsg.value =
      value === null ? 'No default. New members never expire unless you set a date.' : 'Saved.'
  } catch {
    retentionErr.value = 'Could not save.'
  }
}

// Export
const exportPass = ref('')
const exportConfirm = ref('')
const exportBusy = ref(false)
const exportMsg = ref<string | null>(null)
const exportErr = ref<string | null>(null)

async function doExport() {
  exportMsg.value = exportErr.value = null
  if (exportPass.value !== exportConfirm.value) {
    exportErr.value = 'The two passphrases do not match.'
    return
  }
  exportBusy.value = true
  try {
    const bytes = await props.repository.exportEncrypted({ passphrase: exportPass.value })
    download(bytes, `cadre-export-${toDateInput(new Date())}.cadrex`)
    exportMsg.value = 'Export downloaded. It is encrypted; keep its passphrase safe.'
    exportPass.value = exportConfirm.value = ''
  } catch (failure) {
    exportErr.value =
      failure instanceof ExportPassphraseTooShortError
        ? failure.message
        : 'Export failed. Nothing was downloaded.'
  } finally {
    exportBusy.value = false
  }
}

function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'application/octet-stream' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Import
const file = ref<File | null>(null)
const importPass = ref('')
const needsReplace = ref(false)
const importBusy = ref(false)
const importMsg = ref<string | null>(null)
const importErr = ref<string | null>(null)

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  needsReplace.value = false
}

async function doImport(replace: boolean) {
  importMsg.value = importErr.value = null
  if (!file.value) {
    importErr.value = 'Choose an export file first.'
    return
  }
  importBusy.value = true
  try {
    const bundle = new Uint8Array(await file.value.arrayBuffer())
    const result = await props.repository.importEncrypted(bundle, {
      passphrase: importPass.value,
      replace,
    })
    importMsg.value =
      `Imported ${result.imported} ${result.imported === 1 ? 'member' : 'members'}` +
      (result.skippedExpired ? `; skipped ${result.skippedExpired} already expired.` : '.')
    needsReplace.value = false
    importPass.value = ''
    emit('imported')
  } catch (failure) {
    if (failure instanceof StoreNotEmptyError) {
      needsReplace.value = true
    } else if (failure instanceof BundleFormatError) {
      importErr.value = 'That file is not a Cadre export.'
    } else if (failure instanceof UnsupportedFormatError) {
      importErr.value = failure.message
    } else if (failure instanceof UnlockError || failure instanceof DecryptError) {
      importErr.value = 'Wrong passphrase, or the file is damaged.'
    } else {
      importErr.value = 'Import failed. Nothing was changed.'
    }
  } finally {
    importBusy.value = false
  }
}
</script>

<template>
  <section>
    <h1 tabindex="-1">Settings</h1>

    <section aria-labelledby="h-retention">
      <h2 id="h-retention">Retention</h2>
      <form class="row" @submit.prevent="saveRetention">
        <label class="field">
          <span>Default retention (days)</span>
          <input v-model="days" type="text" inputmode="numeric" placeholder="No default" />
        </label>
        <button type="submit" class="btn">Save</button>
      </form>
      <p class="muted">Applies to members added afterwards; existing expiry dates don't change.</p>
      <p v-if="retentionMsg" role="status">{{ retentionMsg }}</p>
      <p v-if="retentionErr" class="error" role="alert">{{ retentionErr }}</p>
    </section>

    <section aria-labelledby="h-export">
      <h2 id="h-export">Export</h2>
      <p class="muted">
        Exports are always encrypted under their own passphrase (at least
        {{ MIN_EXPORT_PASSPHRASE_LENGTH }} characters), not your ledger passphrase.
      </p>
      <form @submit.prevent="doExport">
        <label class="field">
          <span>Export passphrase</span>
          <input v-model="exportPass" type="password" autocomplete="new-password" required />
        </label>
        <label class="field">
          <span>Confirm export passphrase</span>
          <input v-model="exportConfirm" type="password" autocomplete="new-password" required />
        </label>
        <button type="submit" class="btn" :disabled="exportBusy">
          {{ exportBusy ? 'Exporting…' : 'Export' }}
        </button>
      </form>
      <p v-if="exportMsg" role="status">{{ exportMsg }}</p>
      <p v-if="exportErr" class="error" role="alert">{{ exportErr }}</p>
    </section>

    <section aria-labelledby="h-import">
      <h2 id="h-import">Import</h2>
      <form @submit.prevent="doImport(false)">
        <label class="field">
          <span>Export file</span>
          <input type="file" required @change="onFile" />
        </label>
        <label class="field">
          <span>Export passphrase</span>
          <input v-model="importPass" type="password" autocomplete="off" required />
        </label>
        <button type="submit" class="btn" :disabled="importBusy">Import</button>
      </form>
      <div v-if="needsReplace" class="callout" role="alert">
        <p>
          This ledger already has members. Importing replaces all of them with the file's contents,
          and cannot be undone.
        </p>
        <button type="button" class="btn danger" :disabled="importBusy" @click="doImport(true)">
          Delete existing members and import
        </button>
        <button type="button" class="btn" @click="needsReplace = false">Cancel</button>
      </div>
      <p v-if="importMsg" role="status">{{ importMsg }}</p>
      <p v-if="importErr" class="error" role="alert">{{ importErr }}</p>
    </section>

    <section aria-labelledby="h-passphrase">
      <h2 id="h-passphrase">Passphrase</h2>
      <p class="muted">Changing the ledger passphrase isn't available yet.</p>
    </section>
  </section>
</template>
