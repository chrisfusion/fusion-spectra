import type { RetentionRule } from '@/api/indexApi'

// "Versions outside the newest 5 and older than 30 days" — a rule matches versions that
// satisfy every set field (AND); an unset field adds no constraint.
export function describeRetention(rule: RetentionRule | null | undefined): string {
  const parts: string[] = []
  if (rule?.keepLast)   parts.push(`outside the newest ${rule.keepLast}`)
  if (rule?.maxAgeDays) parts.push(`older than ${rule.maxAgeDays} days`)
  return parts.length ? `Versions ${parts.join(' and ')}` : '—'
}

// Compact form for chips: "keep 5 · 30 d"
export function shortRetention(rule: RetentionRule | null | undefined): string {
  const parts: string[] = []
  if (rule?.keepLast)   parts.push(`keep ${rule.keepLast}`)
  if (rule?.maxAgeDays) parts.push(`${rule.maxAgeDays} d`)
  return parts.join(' · ') || '—'
}

// Form input → rule for PUT …/retention; returns an error message instead when invalid.
export function parseRetentionInput(keepLast: string | number, maxAgeDays: string | number): RetentionRule | string {
  const parse = (v: string | number): number | null | undefined => {
    if (v === '' || v === null) return null
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 ? n : undefined
  }
  const kl = parse(keepLast), age = parse(maxAgeDays)
  if (kl === undefined || age === undefined) return 'Values must be whole numbers ≥ 1'
  if (kl === null && age === null) return 'Set keep last, max age, or both'
  return { keepLast: kl, maxAgeDays: age }
}
