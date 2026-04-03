<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="flex flex-center auth-bg">
        <q-card class="auth-card q-pa-lg shadow-10">
          <q-card-section class="flex flex-center column q-gutter-sm">
            <fusion-logo :height="64" class="text-primary" />
            <div class="text-h5 text-weight-bold text-primary">Fusion Spectra</div>
            <div class="text-caption text-grey-6">Data Lake Platform</div>
          </q-card-section>
          <q-card-section>
            <router-view />
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import FusionLogo from '@/components/FusionLogo.vue'
</script>

<style scoped lang="scss">
.auth-bg {
  background: radial-gradient(ellipse at top left, rgba(108, 92, 231, 0.15) 0%, transparent 60%),
              radial-gradient(ellipse at bottom right, rgba(0, 206, 201, 0.1) 0%, transparent 60%);
  min-height: 100vh;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  border-radius: 16px;
}
</style>
