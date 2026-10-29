export type TrendDelta = { tone: 'positive' | 'negative' | 'neutral'; label: string }

export function getTrendDelta(currentCzk: number, previousCzk: number): TrendDelta {
  // With no previous-period activity there's nothing to compare against — a percentage would be
  // undefined and the raw delta would just repeat the headline amount, so show neither.
  if (previousCzk === 0) return { tone: 'neutral', label: currentCzk === 0 ? 'beze změny' : 'bez srovnání' }
  const delta = currentCzk - previousCzk
  if (delta === 0) return { tone: 'neutral', label: 'beze změny' }
  const tone = delta > 0 ? 'positive' : 'negative'
  const percent = Math.round(Math.abs(delta) / Math.abs(previousCzk) * 100)
  return { tone, label: `${delta > 0 ? '+' : '-'}${percent} %` }
}
