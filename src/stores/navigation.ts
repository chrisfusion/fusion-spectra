import { defineStore } from 'pinia'

export interface NavItem {
  label: string
  to: string
  icon: string
}

export const useNavigationStore = defineStore('navigation', () => {
  const items: NavItem[] = [
    { label: 'Overview',  to: '/overview',  icon: 'home' },
    { label: 'Dashboard', to: '/dashboard', icon: 'analytics' },
    { label: 'Jobs',      to: '/jobs',      icon: 'work_outline' },
    { label: 'Venvs',     to: '/venvs',     icon: 'inventory_2' },
    { label: 'Admin',     to: '/admin',     icon: 'admin_panel_settings' },
    { label: 'Help',      to: '/help',      icon: 'help_outline' },
    { label: 'Templates', to: '/index/templates', icon: 'category' },
    { label: 'Index Jobs', to: '/index/jobs',     icon: 'work_history' },
  ]

  return { items }
})
