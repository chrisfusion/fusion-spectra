import { inject, provide, ref, type Ref } from 'vue'

const HELP_KEY = Symbol('helpDrawer')

interface HelpDrawerState {
  open:   Ref<boolean>
  toggle: () => void
  close:  () => void
}

export function provideHelpDrawer(): HelpDrawerState {
  const open  = ref(false)
  const state: HelpDrawerState = {
    open,
    toggle: () => { open.value = !open.value },
    close:  () => { open.value = false },
  }
  provide(HELP_KEY, state)
  return state
}

export function useHelpDrawer(): HelpDrawerState | undefined {
  return inject<HelpDrawerState>(HELP_KEY)
}
