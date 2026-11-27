/** Converting between `Date` and `<input type="date">` values, in the device's time zone. */

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` for the local calendar day `date` falls on. */
export function toDateInput(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The last millisecond of the local day an `<input type="date">` value names, so a member set to
 * expire "on" a day is kept through that day. `null` for an empty or malformed value.
 */
export function fromDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The date `days` from `from`, as the org default retention would set it. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS)
}

export function formatDate(date: Date | null): string {
  return date === null ? 'Never' : date.toLocaleDateString()
}
