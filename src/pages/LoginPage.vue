<template>
  <div class="column q-gutter-md">
    <p class="text-center text-grey-6 q-mb-none" style="font-size: 0.9rem">
      Sign in with your organisation account to continue.
    </p>
    <q-btn
      color="primary"
      icon="login"
      label="Sign in with SSO"
      unelevated
      size="md"
      class="full-width"
      :loading="loading"
      @click="onLogin"
    />
    <p v-if="error" class="text-negative text-center text-caption q-mt-xs">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login } from '@/auth'

const loading = ref(false)
const error = ref('')

async function onLogin() {
  loading.value = true
  error.value = ''
  try {
    await login()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
    loading.value = false
  }
}
</script>
