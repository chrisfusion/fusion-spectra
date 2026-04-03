<template>
  <div class="flex flex-center" style="min-height: 100vh">
    <div class="column items-center q-gutter-md">
      <q-spinner color="primary" size="48px" />
      <p class="text-grey-6">Completing sign-in…</p>
      <p v-if="error" class="text-negative">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { handleCallback } from '@/auth'

const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    await handleCallback()
    await router.replace({ name: 'overview' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Authentication failed'
  }
})
</script>
