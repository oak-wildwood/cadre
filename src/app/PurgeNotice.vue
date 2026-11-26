<script setup lang="ts">
defineProps<{ purged: number | null }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <p v-if="purged" class="purge-notice" role="status">
    Purged {{ purged }} expired {{ purged === 1 ? 'record' : 'records' }}
    <button type="button" @click="$emit('dismiss')">Dismiss</button>
  </p>
</template>

<style scoped>
.purge-notice {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-bg);
  color: var(--color-fg);
  font-size: 0.875rem;
}

button {
  margin-left: 0.5rem;
  background: none;
  border: 0;
  color: var(--color-accent);
  cursor: pointer;
  text-decoration: underline;
}
</style>
