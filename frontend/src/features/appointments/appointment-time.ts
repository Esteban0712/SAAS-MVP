function partsAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function zonedTimeToUtc(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second = 0] = time.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute, second)
  let instant = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = partsAt(new Date(instant), timezone)
    const represented = Date.UTC(
      Number(current.year), Number(current.month) - 1, Number(current.day),
      Number(current.hour), Number(current.minute), Number(current.second),
    )
    const correction = target - represented
    instant += correction
    if (correction === 0) break
  }
  return new Date(instant)
}

export function addLocalDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

export function currentDateInZone(timezone: string) {
  return dateInZone(new Date(), timezone)
}

export function dateInZone(value: Date, timezone: string) {
  const parts = partsAt(value, timezone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function dayRange(date: string, timezone: string) {
  const from = zonedTimeToUtc(date, '00:00:00', timezone)
  const next = zonedTimeToUtc(addLocalDays(date, 1), '00:00:00', timezone)
  return { from: from.toISOString(), to: new Date(next.getTime() - 1).toISOString() }
}

export function formatAppointmentTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export function formatAgendaDate(date: string, timezone: string) {
  const instant = zonedTimeToUtc(date, '12:00:00', timezone)
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: timezone,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(instant)
}
