export const LARGE_DELTA_RATIO = 0.15;

export function catalogCountPreflight(
  currentCounts = {},
  nextCounts = {},
  { largeDeltaRatio = LARGE_DELTA_RATIO } = {}
) {
  const currentPublished = Number(currentCounts?.published ?? 0);
  const nextPublished = Number(nextCounts?.published ?? 0);
  const delta = nextPublished - currentPublished;
  const ratio =
    currentPublished === 0 ? (nextPublished === 0 ? 0 : 1) : Math.abs(delta) / currentPublished;
  return {
    current: currentCounts,
    next: nextCounts,
    delta: { published: delta },
    warning:
      ratio >= largeDeltaRatio
        ? `Large catalog delta: published ${currentPublished} → ${nextPublished} (${delta >= 0 ? "+" : ""}${delta}).`
        : null,
  };
}
