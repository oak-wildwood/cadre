/** Date helpers for `<input type="date">` values, which are local `YYYY-MM-DD` strings. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The last instant of the chosen local day, so "expires on the 5th" keeps the 5th. */
export function endOfLocalDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  const date = new Date(y, m - 1, d, 23, 59, 59, 999)
  return Number.isNaN(date.getTime()) || date.getDate() !== d ? null : date
}

export function formatDate(date: Date | null): string {
  return date === null ? 'Never' : toDateInput(date)
}
