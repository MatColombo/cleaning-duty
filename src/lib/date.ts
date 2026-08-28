const DAY_MS = 86_400_000

export function dateOnlyToUtcMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function addDays(date: string, days: number): string {
  return new Date(dateOnlyToUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateOnlyToUtcMs(to) - dateOnlyToUtcMs(from)) / DAY_MS)
}

export function weekday(date: string): number {
  return new Date(dateOnlyToUtcMs(date)).getUTCDay()
}

function mondayOfWeek(date: string): string {
  const day = weekday(date)
  const offset = day === 0 ? -6 : 1 - day
  return addDays(date, offset)
}

export function weeksBetween(from: string, to: string): number {
  return Math.floor(daysBetween(mondayOfWeek(from), mondayOfWeek(to)) / 7)
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate()
}

export function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const monthIndex = year * 12 + (month - 1) + months
  const targetYear = Math.floor(monthIndex / 12)
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12
  const targetMonth = targetMonthIndex + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return `${targetYear.toString().padStart(4, '0')}-${targetMonth.toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`
}

export function nthWeekdayOfMonth(year: number, month1Based: number, targetWeekday: number, ordinal: 1 | 2 | 3 | 4 | -1): string | null {
  const maxDay = daysInMonth(year, month1Based)
  if (ordinal === -1) {
    for (let day = maxDay; day >= Math.max(1, maxDay - 6); day -= 1) {
      const date = `${year.toString().padStart(4, '0')}-${month1Based.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      if (weekday(date) === targetWeekday) return date
    }
    return null
  }
  let seen = 0
  for (let day = 1; day <= maxDay; day += 1) {
    const date = `${year.toString().padStart(4, '0')}-${month1Based.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    if (weekday(date) !== targetWeekday) continue
    seen += 1
    if (seen === ordinal) return date
  }
  return null
}

export function localDateInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function localTimeInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.hour}:${values.minute}`
}

export function zonedLocalToUtc(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  let guess = desired

  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const rendered = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    const delta = desired - rendered
    guess += delta
    if (Math.abs(delta) < 1_000) break
  }

  return new Date(guess).toISOString()
}

export function localDateTimeInZone(timeZone: string, instant: string | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function dateTimeLocalValue(iso: string, timeZone: string): string {
  return localDateTimeInZone(timeZone, iso)
}

export function localInputToUtc(value: string, timeZone: string): string {
  const [date, time] = value.split('T')
  return zonedLocalToUtc(date, time, timeZone)
}

export function formatTaskTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTaskDateTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
