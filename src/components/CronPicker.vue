<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
  error?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

type PresetId = 'every5' | 'every15' | 'every30' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const PRESET_OPTIONS: { id: PresetId; label: string }[] = [
  { id: 'every5',  label: 'Every 5 minutes' },
  { id: 'every15', label: 'Every 15 minutes' },
  { id: 'every30', label: 'Every 30 minutes' },
  { id: 'hourly',  label: 'Hourly' },
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom',  label: 'Custom (advanced)' },
]

const preset      = ref<PresetId>('daily')
const hour        = ref(9)
const minute      = ref(0)
const weekday     = ref(1)
const dayOfMonth  = ref(1)
const customValue = ref('')

const pad = (n: number) => String(n).padStart(2, '0')
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))

// Clamp the displayed value on blur (not on every keystroke, so typing "1"
// then "2" for "12" isn't force-corrected mid-entry) — keeps the number
// shown in the field consistent with what buildCron() actually emits.
function clampHour()  { hour.value = clamp(hour.value, 0, 23) }
function clampMinute() { minute.value = clamp(minute.value, 0, 59) }
function clampDay()   { dayOfMonth.value = clamp(dayOfMonth.value, 1, 31) }

function buildCron(): string {
  switch (preset.value) {
    case 'every5':  return '*/5 * * * *'
    case 'every15': return '*/15 * * * *'
    case 'every30': return '*/30 * * * *'
    case 'hourly':  return '0 * * * *'
    case 'daily':   return `${clamp(minute.value, 0, 59)} ${clamp(hour.value, 0, 23)} * * *`
    case 'weekly':  return `${clamp(minute.value, 0, 59)} ${clamp(hour.value, 0, 23)} * * ${clamp(weekday.value, 0, 6)}`
    case 'monthly': return `${clamp(minute.value, 0, 59)} ${clamp(hour.value, 0, 23)} ${clamp(dayOfMonth.value, 1, 31)} * *`
    case 'custom':  return customValue.value
  }
}

// Best-effort reverse mapping: given an existing cron string, select the
// matching preset (and prefill its fields) so re-opening this component
// with an already-set schedule doesn't dump the user into raw-text mode.
function detectPreset(expr: string) {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) {
    preset.value = 'custom'
    customValue.value = expr
    return
  }
  const [min, hr, dom, mon, dow] = parts
  let m: RegExpMatchArray | null

  if ((m = min.match(/^\*\/(5|15|30)$/)) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    preset.value = `every${m[1]}` as PresetId
    return
  }
  if (min === '0' && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    preset.value = 'hourly'
    return
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*' && dow === '*') {
    preset.value = 'daily'
    hour.value = +hr
    minute.value = +min
    return
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*' && /^[0-6]$/.test(dow)) {
    preset.value = 'weekly'
    hour.value = +hr
    minute.value = +min
    weekday.value = +dow
    return
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    preset.value = 'monthly'
    hour.value = +hr
    minute.value = +min
    dayOfMonth.value = +dom
    return
  }
  preset.value = 'custom'
  customValue.value = expr
}

onMounted(() => {
  if (props.modelValue.trim()) {
    detectPreset(props.modelValue)
  } else {
    emit('update:modelValue', buildCron())
  }
})

watch([preset, hour, minute, weekday, dayOfMonth], () => {
  if (preset.value !== 'custom') emit('update:modelValue', buildCron())
})

watch(customValue, () => {
  if (preset.value === 'custom') emit('update:modelValue', customValue.value)
})

const summary = computed(() => describeCron(props.modelValue))

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return expr ? `Custom schedule: ${expr}` : 'No schedule set'
  const [min, hr, dom, mon, dow] = parts
  let m: RegExpMatchArray | null

  if ((m = min.match(/^\*\/(\d+)$/)) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${m[1]} minutes`
  }
  if (min === '0' && (m = hr.match(/^\*\/(\d+)$/)) && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${m[1]} hours`
  }
  if (/^\d+$/.test(min) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every hour at minute ${min}`
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*' && dow === '*') {
    return `Every day at ${pad(+hr)}:${pad(+min)}`
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*' && /^[0-6]$/.test(dow)) {
    return `Every ${WEEKDAY_NAMES[+dow]} at ${pad(+hr)}:${pad(+min)}`
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    return `On day ${dom} of every month at ${pad(+hr)}:${pad(+min)}`
  }
  return `Custom schedule: ${expr}`
}
</script>

<template>
  <div class="cronp">
    <div class="cronp__row">
      <select v-model="preset" class="cronp__select">
        <option v-for="opt in PRESET_OPTIONS" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>

      <template v-if="preset === 'daily' || preset === 'weekly' || preset === 'monthly'">
        <select v-if="preset === 'weekly'" v-model.number="weekday" class="cronp__select cronp__select--narrow">
          <option v-for="(name, i) in WEEKDAY_NAMES" :key="i" :value="i">{{ name }}</option>
        </select>
        <template v-if="preset === 'monthly'">
          <span class="cronp__label">day</span>
          <input v-model.number="dayOfMonth" type="number" min="1" max="31" class="cronp__input cronp__input--narrow" @blur="clampDay" />
        </template>
        <span class="cronp__label">at</span>
        <input v-model.number="hour" type="number" min="0" max="23" class="cronp__input cronp__input--narrow" @blur="clampHour" />
        <span class="cronp__colon">:</span>
        <input v-model.number="minute" type="number" min="0" max="59" class="cronp__input cronp__input--narrow" @blur="clampMinute" />
      </template>
    </div>

    <div v-if="preset === 'custom'" class="cronp__row">
      <input
        v-model="customValue"
        class="cronp__input cronp__input--mono cronp__input--wide"
        placeholder="*/5 * * * *"
      />
    </div>

    <span v-if="error" class="cronp__error">{{ error }}</span>
    <span v-else class="cronp__summary">
      <q-icon name="mdi-information-outline" size="12px" />
      {{ summary }}
    </span>
  </div>
</template>

<style scoped>
.cronp {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cronp__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cronp__label {
  font-size: 12px;
  color: var(--fs-text-muted);
}
.cronp__colon {
  font-size: 12px;
  color: var(--fs-text-muted);
  margin: 0 -4px;
}

.cronp__select,
.cronp__input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.cronp__select:focus,
.cronp__input:focus { border-color: var(--fs-accent); }

.cronp__select--narrow { flex: none; }
.cronp__input--narrow  { width: 56px; text-align: center; flex: none; }
.cronp__input--wide    { width: 100%; }
.cronp__input--mono    { font-family: var(--fs-font-mono); }

.cronp__summary {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--fs-text-muted);
}
.cronp__error {
  font-size: 11px;
  color: var(--fs-neg, #e57373);
}
</style>
