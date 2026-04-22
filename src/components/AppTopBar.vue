<script setup lang="ts">
import { ref } from 'vue'

const userMenuOpen = ref(false)
const searchQuery  = ref('')
</script>

<template>
  <header class="topbar">
    <!-- Logo -->
    <div class="topbar__logo">
      <svg class="topbar__logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Atom nucleus -->
        <circle cx="16" cy="16" r="2.5" fill="#00d4ff" />
        <!-- Orbit 1 -->
        <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#orb1)" stroke-width="1.2" fill="none" />
        <!-- Orbit 2 rotated 60deg -->
        <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#orb2)" stroke-width="1.2" fill="none"
          transform="rotate(60 16 16)" />
        <!-- Orbit 3 rotated -60deg -->
        <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#orb3)" stroke-width="1.2" fill="none"
          transform="rotate(-60 16 16)" />
        <defs>
          <linearGradient id="orb1" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
            <stop stop-color="#8b5cf6" />
            <stop offset="0.5" stop-color="#00d4ff" />
            <stop offset="1" stop-color="#10b981" />
          </linearGradient>
          <linearGradient id="orb2" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
            <stop stop-color="#3b82f6" />
            <stop offset="1" stop-color="#8b5cf6" />
          </linearGradient>
          <linearGradient id="orb3" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
            <stop stop-color="#00d4ff" />
            <stop offset="1" stop-color="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      <div class="topbar__logo-text">
        <span class="topbar__logo-fusion fs-gradient-text">fusion</span>
        <span class="topbar__logo-spectra">SPECTRA</span>
      </div>
    </div>

    <!-- Search -->
    <div class="topbar__search">
      <q-icon name="mdi-magnify" size="15px" class="topbar__search-icon" />
      <input
        v-model="searchQuery"
        class="topbar__search-input fs-mono"
        placeholder="Search datasets, pipelines, jobs…"
        type="text"
      />
      <kbd class="topbar__search-kbd">⌘K</kbd>
    </div>

    <!-- Right controls -->
    <div class="topbar__right">
      <!-- Notifications -->
      <button class="topbar__icon-btn">
        <q-icon name="mdi-bell-outline" size="18px" />
        <span class="topbar__notif-dot" />
        <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 6]">Notifications</q-tooltip>
      </button>

      <!-- Docs -->
      <button class="topbar__icon-btn">
        <q-icon name="mdi-book-open-outline" size="18px" />
        <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 6]">Documentation</q-tooltip>
      </button>

      <div class="topbar__divider" />

      <!-- User menu -->
      <div class="topbar__user" @click="userMenuOpen = !userMenuOpen">
        <div class="topbar__avatar">
          <span>JD</span>
        </div>
        <div class="topbar__user-info">
          <span class="topbar__user-name">Jane Doe</span>
          <span class="topbar__user-role">Admin</span>
        </div>
        <q-icon name="mdi-chevron-down" size="14px" class="topbar__user-chevron"
          :class="{ 'topbar__user-chevron--open': userMenuOpen }" />

        <q-menu v-model="userMenuOpen" anchor="bottom right" self="top right" :offset="[0, 8]"
          class="topbar__user-menu">
          <div class="usermenu">
            <div class="usermenu__header">
              <div class="usermenu__avatar-lg"><span>JD</span></div>
              <div>
                <div class="usermenu__name">Jane Doe</div>
                <div class="usermenu__email fs-mono">jane@fusion.local</div>
              </div>
            </div>
            <div class="usermenu__sep" />
            <button class="usermenu__item">
              <q-icon name="mdi-account-outline" size="15px" />
              <span>Profile</span>
            </button>
            <button class="usermenu__item">
              <q-icon name="mdi-cog-outline" size="15px" />
              <span>Preferences</span>
            </button>
            <button class="usermenu__item">
              <q-icon name="mdi-palette-outline" size="15px" />
              <span>Appearance</span>
            </button>
            <div class="usermenu__sep" />
            <button class="usermenu__item usermenu__item--danger">
              <q-icon name="mdi-logout" size="15px" />
              <span>Sign out</span>
            </button>
          </div>
        </q-menu>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--fs-topbar-h);
  padding: 0 16px 0 0;
  background: var(--fs-bg-deep);
  border-bottom: 1px solid var(--fs-border);
}

/* Logo */
.topbar__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(var(--fs-rail-w) + var(--fs-sidebar-w));
  flex-shrink: 0;
  padding-left: 14px;
}

.topbar__logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.topbar__logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
  gap: 1px;
}

.topbar__logo-fusion {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.topbar__logo-spectra {
  font-family: var(--fs-font-mono);
  font-size: 8.5px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--fs-text-muted);
  text-transform: uppercase;
}

/* Search */
.topbar__search {
  flex: 1;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  transition: border-color var(--fs-ease), box-shadow var(--fs-ease);
}

.topbar__search:focus-within {
  border-color: var(--fs-accent);
  box-shadow: 0 0 0 2px var(--fs-accent-soft);
}

.topbar__search-icon { color: var(--fs-text-muted); flex-shrink: 0; }

.topbar__search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--fs-text-primary);
  font-size: 12px;
  min-width: 0;
}

.topbar__search-input::placeholder { color: var(--fs-text-muted); }

.topbar__search-kbd {
  font-family: var(--fs-font-mono);
  font-size: 10px;
  color: var(--fs-text-muted);
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
}

/* Right */
.topbar__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar__icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--fs-text-secondary);
  cursor: pointer;
  transition: background var(--fs-ease), color var(--fs-ease);
}

.topbar__icon-btn:hover {
  background: var(--fs-bg-hover);
  color: var(--fs-text-primary);
}

.topbar__notif-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fs-red);
  border: 1.5px solid var(--fs-bg-deep);
}

.topbar__divider {
  width: 1px;
  height: 22px;
  background: var(--fs-border);
  margin: 0 6px;
}

/* User */
.topbar__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background var(--fs-ease);
}

.topbar__user:hover { background: var(--fs-bg-hover); }

.topbar__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--fs-violet), var(--fs-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.topbar__user-info {
  display: flex;
  flex-direction: column;
  line-height: 1;
  gap: 2px;
}

.topbar__user-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fs-text-primary);
}

.topbar__user-role {
  font-family: var(--fs-font-mono);
  font-size: 10px;
  color: var(--fs-accent);
}

.topbar__user-chevron {
  color: var(--fs-text-muted);
  transition: transform var(--fs-ease);
}

.topbar__user-chevron--open { transform: rotate(180deg); }

/* User menu */
:deep(.topbar__user-menu .q-menu) {
  background: var(--fs-bg-elevated) !important;
  border: 1px solid var(--fs-border-bright) !important;
  border-radius: 6px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
}

.usermenu {
  padding: 6px;
  min-width: 200px;
}

.usermenu__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 10px;
}

.usermenu__avatar-lg {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--fs-violet), var(--fs-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.usermenu__name  { font-size: 13px; font-weight: 500; color: var(--fs-text-primary); }
.usermenu__email { font-size: 10.5px; color: var(--fs-text-muted); margin-top: 2px; }

.usermenu__sep {
  height: 1px;
  background: var(--fs-border);
  margin: 4px 0;
}

.usermenu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  background: none;
  border: none;
  border-radius: 3px;
  color: var(--fs-text-secondary);
  font-size: 12.5px;
  font-family: var(--fs-font-ui);
  cursor: pointer;
  text-align: left;
  transition: background var(--fs-ease), color var(--fs-ease);
}

.usermenu__item:hover {
  background: var(--fs-bg-hover);
  color: var(--fs-text-primary);
}

.usermenu__item--danger { color: var(--fs-red); }
.usermenu__item--danger:hover { background: rgba(239, 68, 68, 0.08); color: var(--fs-red); }
</style>
