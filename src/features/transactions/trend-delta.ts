import { formatCzk } from '../../lib/format-czk'

export type TrendDelta = { tone: 'positive' | 'negative' | 'neutral'; label: string; comparable: boolean }

// The difference in crowns against the previous period, not a percentage: on a net total that sits
// near zero (or crosses it) a percentage explodes or flips sign and says nothing useful.
export function getTrendDelta(currentCzk: number, previousCzk: number): TrendDelta {
  // With no previous-period activity there's nothing to compare against — the raw delta would just
  // repeat the headline amount, so show a neutral note instead.
  if (previousCzk === 0) return { tone: 'neutral', label: currentCzk === 0 ? 'beze změny' : 'bez srovnání', comparable: false }
  const delta = currentCzk - previousCzk
  if (delta === 0) return { tone: 'neutral', label: 'beze změny', comparable: false }
  return { tone: delta > 0 ? 'positive' : 'negative', label: formatCzk(delta, { signed: true }), comparable: true }
}
