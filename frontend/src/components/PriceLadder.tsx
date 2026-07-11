interface PriceLevel {
  label: string;
  value: number | null;
  kind: "target" | "current" | "entry" | "stop" | "partial";
}

interface PartialExitLevel {
  price: number;
  quantity: number | null;
}

interface PriceLadderProps {
  entry: number | null;
  currentPrice: number | null;
  currentStop: number | null;
  target1: number;
  target2: number | null;
  partialExits?: PartialExitLevel[];
}

const TRACK_HEIGHT_PX = 260;
const LABEL_MIN_GAP_PX = 20;
const LABEL_EDGE_PADDING_PX = 8;

export function spreadLabelPositions(
  positions: number[],
  minimumGap = LABEL_MIN_GAP_PX,
  minimum = LABEL_EDGE_PADDING_PX,
  maximum = TRACK_HEIGHT_PX - LABEL_EDGE_PADDING_PX,
): number[] {
  if (positions.length < 2) return [...positions];
  const indexed = positions
    .map((position, index) => ({ position, index }))
    .sort((left, right) => left.position - right.position);
  const adjusted = indexed.map((item) => item.position);

  for (let index = 1; index < adjusted.length; index += 1) {
    adjusted[index] = Math.max(adjusted[index], adjusted[index - 1] + minimumGap);
  }
  if (adjusted[adjusted.length - 1] > maximum) {
    adjusted[adjusted.length - 1] = maximum;
    for (let index = adjusted.length - 2; index >= 0; index -= 1) {
      adjusted[index] = Math.min(adjusted[index], adjusted[index + 1] - minimumGap);
    }
  }
  if (adjusted[0] < minimum) {
    const shift = minimum - adjusted[0];
    for (let index = 0; index < adjusted.length; index += 1) adjusted[index] += shift;
  }

  const restored = Array<number>(positions.length);
  indexed.forEach((item, index) => { restored[item.index] = adjusted[index]; });
  return restored;
}

export function PriceLadder({
  entry,
  currentPrice,
  currentStop,
  target1,
  target2,
  partialExits = [],
}: PriceLadderProps) {
  const candidateLevels: PriceLevel[] = [
    { label: "Target 2", value: target2, kind: "target" },
    { label: "Target 1", value: target1, kind: "target" },
    ...partialExits.map((exit, index) => ({
      label: exit.quantity === null
        ? `Partial ${index + 1}`
        : `Partial ${index + 1} (${exit.quantity})`,
      value: exit.price,
      kind: "partial" as const,
    })),
    { label: "Current", value: currentPrice, kind: "current" },
    { label: "Entry", value: entry, kind: "entry" },
    { label: "Stop", value: currentStop, kind: "stop" },
  ];
  const levels = candidateLevels.filter((level) => level.value !== null);

  const prices = levels.map((level) => level.value as number);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const range = maximum - minimum || 1;
  const markerTops = levels.map(
    (level) => 7 + ((maximum - (level.value as number)) / range) * 86,
  );
  const labelTops = spreadLabelPositions(
    markerTops.map((top) => (top / 100) * TRACK_HEIGHT_PX),
  );

  return (
    <section className="price-ladder" aria-label="Trade price levels">
      <div className="price-ladder-heading">
        <div>
          <p className="eyebrow">Price map</p>
          <h3>Trade levels</h3>
        </div>
        <span>Manual price fallback</span>
      </div>
      <div className="price-ladder-track">
        {levels.map((level, index) => {
          const top = markerTops[index];
          const labelOffset = labelTops[index] - (top / 100) * TRACK_HEIGHT_PX;
          return (
            <div
              className={`price-marker price-${level.kind}`}
              style={{ top: `${top}%` }}
              key={level.label}
            >
              <span style={{ transform: `translateY(${labelOffset}px)` }}>{level.label}</span>
              <i aria-hidden="true" />
              <strong style={{ transform: `translateY(${labelOffset}px)` }}>{level.value}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
