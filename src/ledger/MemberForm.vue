<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { MemberId } from '../domain/member'
import { SENSITIVE_FIELDS, type SensitiveField } from '../domain/sensitiveFields'
import { addDays, fromDateInput, toDateInput } from './dates'
import { errorMessage } from './messages'

const props = defineProps<{ repository: LedgerRepository; memberId: MemberId | null }>()
const emit = defineEmits<{ saved: [id: MemberId]; deleted: []; cancel: [] }>()

interface FieldSpec {
  name: SensitiveField
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea'
}

/** Every editable member field. Which are sensitive comes from `SENSITIVE_FIELDS`, not here. */
const FIELDS: FieldSpec[] = [
  { name: 'displayName', label: 'Name', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'role', label: 'Role', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
]

function isSensitive(field: string): boolean {
  return field in SENSITIVE_FIELDS
}

const values = reactive<Record<SensitiveField, string>>({
  displayName: '',
  email: '',
  phone: '',
  role: '',
  notes: '',
})
const expires = ref('')
const neverExpires = ref(false)
const defaultDays = ref<number | null>(null)

const loading = ref(true)
const saving = ref(false)
const confirmingDelete = ref(false)
const error = ref<string | null>(null)
const notFound = ref(false)

const isNew = computed(() => props.memberId === null)

onMounted(async () => {
  try {
    if (props.memberId === null) {
      defaultDays.value = await props.repository.getDefaultRetentionDays()
      if (defaultDays.value === null) {
        neverExpires.value = true
      } else {
        expires.value = toDateInput(addDays(new Date(), defaultDays.value))
      }
    } else {
      const member = await props.repository.read(props.memberId)
      if (member === null) {
        notFound.value = true
        return
      }
      for (const field of FIELDS) {
        values[field.name] = member[field.name] ?? ''
      }
      neverExpires.value = member.expiresAt === null
      expires.value = member.expiresAt ? toDateInput(member.expiresAt) : ''
    }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
})

function optional(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function save(): Promise<void> {
  error.value = null
  const displayName = values.displayName.trim()
  if (displayName === '') {
    error.value = 'A name is required.'
    return
  }
  let expiresAt: Date | null = null
  if (!neverExpires.value) {
    expiresAt = fromDateInput(expires.value)
    if (expiresAt === null) {
      error.value = 'Pick an expiry date, or tick "Never expires".'
      return
    }
    if (expiresAt.getTime() <= Date.now()) {
      error.value = 'The expiry date has passed: the member would be purged straight away.'
      return
    }
  }
  const input = {
    displayName,
    email: optional(values.email),
    phone: optional(values.phone),
    role: optional(values.role),
    notes: optional(values.notes),
    expiresAt,
  }
  saving.value = true
  try {
    const member =
      props.memberId === null
        ? await props.repository.create(input)
        : await props.repository.update(props.memberId, input)
    emit('saved', member.id)
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (props.memberId === null) {
    return
  }
  saving.value = true
  error.value = null
  try {
    await props.repository.delete(props.memberId)
    emit('deleted')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
    confirmingDelete.value = false
  }
}
</script>

<template>
  <section aria-labelledby="form-heading">
    <h2 id="form-heading" tabindex="-1">{{ isNew ? 'Add member' : 'Edit member' }}</h2>

    <p v-if="loading" role="status">Loading…</p>
    <template v-else-if="notFound">
      <p role="alert">This member no longer exists. It may have expired and been purged.</p>
      <button type="button" @click="emit('cancel')">Back to members</button>
    </template>

    <form v-else novalidate autocomplete="off" @submit.prevent="save">
      <p class="hint">
        Fields marked <span class="badge">Encrypted</span> are encrypted on this device before they
        are stored.
      </p>

      <div v-for="field in FIELDS" :key="field.name" class="field">
        <label :for="`member-${field.name}`">
          {{ field.label }}<template v-if="field.name === 'displayName'"> (required)</template>
          <span v-if="isSensitive(field.name)" class="badge">Encrypted</span>
        </label>
        <textarea
          v-if="field.type === 'textarea'"
          :id="`member-${field.name}`"
          v-model="values[field.name]"
          rows="4"
          :disabled="saving"
        ></textarea>
        <input
          v-else
          :id="`member-${field.name}`"
          v-model="values[field.name]"
          :type="field.type"
          autocomplete="off"
          :required="field.name === 'displayName'"
          :aria-required="field.name === 'displayName'"
          :disabled="saving"
        />
      </div>

      <fieldset class="field">
        <legend>Retention</legend>
        <label for="member-expires">Expires on</label>
        <input
          id="member-expires"
          v-model="expires"
          type="date"
          :disabled="saving || neverExpires"
          aria-describedby="expires-hint"
        />
        <label class="inline">
          <input v-model="neverExpires" type="checkbox" :disabled="saving" />
          Never expires
        </label>
        <p id="expires-hint" class="hint">
          The member is deleted for good at the end of this day.
          <template v-if="isNew && defaultDays !== null">
            Pre-filled from the default of {{ defaultDays }} days.
          </template>
        </p>
      </fieldset>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button type="submit" :disabled="saving">{{ isNew ? 'Add member' : 'Save' }}</button>
        <button type="button" :disabled="saving" @click="emit('cancel')">Cancel</button>
        <template v-if="!isNew">
          <button
            v-if="!confirmingDelete"
            type="button"
            class="danger"
            :disabled="saving"
            @click="confirmingDelete = true"
          >
            Delete member
          </button>
          <span v-else role="group" aria-label="Confirm delete">
            This can't be undone.
            <button type="button" class="danger" :disabled="saving" @click="remove">
              Delete permanently
            </button>
            <button type="button" :disabled="saving" @click="confirmingDelete = false">Keep</button>
          </span>
        </template>
      </div>
    </form>
  </section>
</template>

<style scoped>
form > .hint {
  margin-bottom: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0 0 1rem;
}

fieldset {
  border: 1px solid var(--color-border);
  padding: 0.75rem;
}

.inline {
  flex-direction: row;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>
