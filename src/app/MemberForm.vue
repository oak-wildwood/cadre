<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member, MemberPatch } from '../domain/member'
import { SENSITIVE_FIELD_NAMES, type SensitiveField } from '../domain/sensitiveFields'
import { endOfLocalDay, toDateInput } from './dates'

const props = defineProps<{ repository: LedgerRepository; memberId: string | null }>()
const emit = defineEmits<{ saved: []; cancel: []; deleted: [] }>()

const LABELS: Record<SensitiveField, string> = {
  displayName: 'Name',
  email: 'Email',
  phone: 'Phone',
  role: 'Role',
  notes: 'Notes',
}
const OPTIONAL = ['email', 'phone', 'role', 'notes'] as const

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const confirmDelete = ref(false)
const deleting = ref(false)
const defaultApplied = ref(false)
const form = reactive({
  displayName: '',
  email: '',
  phone: '',
  role: '',
  notes: '',
  expires: '',
  never: true,
})
// What the expiry controls held when the form opened, to tell an untouched expiry from an edit.
let initial = { expires: '', never: true }
let existing: Member | null = null

const isNew = computed(() => props.memberId === null)

onMounted(async () => {
  try {
    if (props.memberId === null) {
      const days = await props.repository.getDefaultRetentionDays()
      if (days !== null) {
        form.never = false
        defaultApplied.value = true
        form.expires = toDateInput(new Date(Date.now() + days * 86_400_000))
      }
    } else {
      existing = await props.repository.read(props.memberId)
      if (!existing) {
        error.value = 'That member no longer exists.'
        return
      }
      form.displayName = existing.displayName
      for (const field of OPTIONAL) form[field] = existing[field] ?? ''
      form.never = existing.expiresAt === null
      form.expires = existing.expiresAt ? toDateInput(existing.expiresAt) : ''
    }
    initial = { expires: form.expires, never: form.never }
  } catch {
    error.value = 'Could not load this member.'
  } finally {
    loading.value = false
  }
})

const expiryChanged = () => form.never !== initial.never || form.expires !== initial.expires

/** The chosen expiry: `undefined` = untouched (org default for a new member), `null` = never. */
function chosenExpiry(): Date | null | undefined | 'invalid' {
  if (!expiryChanged()) return undefined
  if (form.never) return null
  const date = endOfLocalDay(form.expires)
  return date && date.getTime() > Date.now() ? date : 'invalid'
}

async function onSave() {
  error.value = null
  const name = form.displayName.trim()
  if (!name) {
    error.value = 'Name is required.'
    return
  }
  const expiry = chosenExpiry()
  if (expiry === 'invalid') {
    error.value = 'Pick a future expiry date, or choose "Never expires".'
    return
  }
  const optional = Object.fromEntries(
    OPTIONAL.map((f) => [f, form[f].trim() === '' ? null : form[f].trim()]),
  ) as Record<(typeof OPTIONAL)[number], string | null>
  saving.value = true
  try {
    if (props.memberId === null) {
      await props.repository.create({ displayName: name, ...optional, expiresAt: expiry })
    } else {
      const patch: MemberPatch = { displayName: name, ...optional }
      if (expiry !== undefined) patch.expiresAt = expiry
      await props.repository.update(props.memberId, patch)
    }
    emit('saved')
  } catch {
    // Not the error's text: it could carry a field value.
    error.value = 'Could not save. Nothing was changed.'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (props.memberId === null || deleting.value) return
  deleting.value = true
  try {
    await props.repository.delete(props.memberId)
    emit('deleted')
  } catch {
    error.value = 'Could not delete this member.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section>
    <h1 tabindex="-1">{{ isNew ? 'Add member' : 'Edit member' }}</h1>
    <p v-if="loading" role="status">Loading…</p>
    <form v-else-if="isNew || existing" @submit.prevent="onSave">
      <p class="muted"><span class="badge">sensitive</span> fields are encrypted before storage.</p>
      <label v-for="field in SENSITIVE_FIELD_NAMES" :key="field" class="field">
        <span>
          {{ LABELS[field] }}
          <span class="badge" aria-hidden="true">sensitive</span>
        </span>
        <textarea v-if="field === 'notes'" v-model="form.notes" rows="4"></textarea>
        <input
          v-else
          v-model="form[field]"
          :type="field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'"
          :required="field === 'displayName'"
          autocomplete="off"
        />
      </label>
      <fieldset class="field">
        <legend>Expiry</legend>
        <label class="inline"> <input v-model="form.never" type="checkbox" /> Never expires </label>
        <label class="field">
          <span>Expires on</span>
          <input v-model="form.expires" type="date" :disabled="form.never" />
        </label>
        <p class="muted">
          <template v-if="isNew && defaultApplied"
            >Pre-filled from the organization default. </template
          >Expired records are deleted automatically.
        </p>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="row">
        <button type="submit" class="btn primary" :disabled="saving">Save</button>
        <button type="button" class="btn" @click="emit('cancel')">Cancel</button>
        <template v-if="!isNew">
          <button
            v-if="!confirmDelete"
            type="button"
            class="btn danger"
            @click="confirmDelete = true"
          >
            Delete…
          </button>
          <span v-else role="group" aria-label="Confirm delete">
            Delete this member permanently?
            <button type="button" class="btn danger" :disabled="deleting" @click="onDelete">
              Yes, delete
            </button>
            <button type="button" class="btn" @click="confirmDelete = false">No</button>
          </span>
        </template>
      </div>
    </form>
    <template v-else>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="button" class="btn" @click="emit('cancel')">Back</button>
    </template>
  </section>
</template>
