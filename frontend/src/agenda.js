/*
 * The committee's rundown, as the attendee reads it.
 *
 * Most of the programme is one day, so the agenda is a plain list. But not
 * everything is: the Gold Club breakfast is the morning after, and a list
 * that showed "08:00" with no date would look like the conference starting
 * over. So the day is named whenever there is more than one of them.
 */

export const timeOf = (iso) => (iso || '').slice(11, 16)
export const dateOf = (iso) => (iso || '').slice(0, 10)

export function dayLabel(date) {
  const d = new Date(`${date}T00:00:00+07:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta',
  })
}

export function groupByDay(blocks) {
  const days = []
  for (const b of [...(blocks || [])].sort((a, z) =>
    (a.starts_at || '').localeCompare(z.starts_at || ''),
  )) {
    const date = dateOf(b.starts_at)
    const last = days[days.length - 1]
    if (last && last.date === date) last.blocks.push(b)
    else days.push({ date, blocks: [b] })
  }
  return days
}
