<template>
  <q-layout view="lHh Lpr lFf">
    <q-header
      elevated
      :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
    >
      <q-toolbar>
        <q-btn
          flat round dense
          icon="menu"
          :color="$q.dark.isActive ? 'white' : 'grey-8'"
          @click="mini = !mini"
        />
        <fusion-logo :height="28" class="q-ml-sm" :class="$q.dark.isActive ? 'text-white' : 'text-primary'" />
        <span
          class="q-ml-sm text-weight-bold text-primary"
          style="font-size: 1.1rem; letter-spacing: 0.02em"
        >
          Fusion Spectra
        </span>
        <q-space />
        <theme-toggle />
        <q-btn flat round dense class="q-ml-xs">
          <q-avatar
            size="30px"
            color="primary"
            text-color="white"
            style="font-size: 0.85rem"
          >
            {{ userInitial }}
          </q-avatar>
          <q-menu>
            <q-list style="min-width: 180px">
              <q-item>
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ auth.user?.name }}</q-item-label>
                  <q-item-label caption>{{ auth.user?.email }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="onLogout">
                <q-item-section avatar>
                  <q-icon name="logout" size="18px" />
                </q-item-section>
                <q-item-section>Sign out</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      :mini="mini"
      :width="220"
      :mini-width="56"
      bordered
      :class="$q.dark.isActive ? 'bg-dark-page' : 'bg-grey-1'"
    >
      <q-scroll-area style="height: calc(100% - 50px)">
        <q-list padding>
          <q-item
            v-for="item in nav.items"
            :key="item.to"
            :to="item.to"
            clickable
            v-ripple
            active-class="text-primary"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" />
            </q-item-section>
            <q-item-section>{{ item.label }}</q-item-section>
            <q-tooltip v-if="mini" anchor="center right" self="center left">
              {{ item.label }}
            </q-tooltip>
          </q-item>
        </q-list>
      </q-scroll-area>

      <div class="absolute-bottom" style="padding-bottom: 4px">
        <q-separator />
        <q-item clickable v-ripple @click="mini = !mini" style="min-height: 48px">
          <q-item-section avatar>
            <q-icon :name="mini ? 'chevron_right' : 'chevron_left'" />
          </q-item-section>
          <q-item-section class="text-caption">Collapse</q-item-section>
        </q-item>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { logout } from '@/auth'
import FusionLogo from '@/components/FusionLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const auth = useAuthStore()
const nav = useNavigationStore()

const drawerOpen = ref(true)
const mini = ref(false)

const userInitial = computed(() =>
  auth.user?.name?.charAt(0).toUpperCase() ?? '?'
)

async function onLogout() {
  await logout()
}
</script>
