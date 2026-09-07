export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
