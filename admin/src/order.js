/*
 * Where WIT.id sits in a list.
 *
 * The committee asked for it first wherever exhibitors are listed, the way
 * sponsors already came first on the attendee passport. It is a placement, so
 * it applies to LISTS only — the dashboard's Booth Ranking is a count of
 * scans, and putting anyone at the top of that would state something untrue
 * about the day.
 *
 * Matched on the name rather than the booth code: the floor plan has been
 * renumbered once already.
 */
export const FIRST_EXHIBITOR = 'WIT.id'

export const isFirstExhibitor = (t) => (t?.name || '').trim().toLowerCase() === FIRST_EXHIBITOR.toLowerCase()

/** A copy of the rows with WIT.id moved to the front, everything else as-is. */
export function witFirst(rows = []) {
  const first = rows.filter(isFirstExhibitor)
  return first.length ? [...first, ...rows.filter((t) => !isFirstExhibitor(t))] : rows
}
