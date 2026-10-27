// Cron helpers shared by CronPicker (editing) and the WeaveApp entrypoint tables (display).
// Weave schedules are 6 fields, seconds first; legacy 5-field values are still understood.

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const pad = (n: number) => String(n).padStart(2, '0')

// A 6-field expression whose seconds are exactly "0" maps back onto minute-resolution cron;
// legacy 5-field values pass through. Anything else (non-zero seconds, odd length) → null.
export function minuteFields(expr: string): string[] | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length === 5) return parts
  if (parts.length === 6 && parts[0] === '0') return parts.slice(1)
  return null
}

export function describeCron(expr: string): string {
  const parts = minuteFields(expr)
  if (!parts) return expr.trim() ? `Custom schedule: ${expr}` : 'No schedule set'
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
