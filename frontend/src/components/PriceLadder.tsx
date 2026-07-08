interface PriceLevel {
  label: string;
  value: number | null;
  kind: "target" | "current" | "entry" | "stop";
}

interface PriceLadderProps {
  entry: number | null;
  currentPrice: number | null;
  currentStop: number | null;
  target1: number;
  target2: number | null;
}

export function PriceLadder({
  entry,
  currentPrice,
  currentStop,
  target1,
  target2,
}: PriceLadderProps) {
  const candidateLevels: PriceLevel[] = [
    { label: "Target 2", value: target2, kind: "target" },
    { label: "Target 1", value: target1, kind: "target" },
    { label: "Current", value: currentPrice, kind: "current" },
    { label: "Entry", value: entry, kind: "entry" },
    { label: "Stop", value: currentStop, kind: "stop" },
  ];
  const levels = candidateLevels.filter((level) => level.value !== null);

  const prices = levels.map((level) => level.value as number);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const range = maximum - minimum || 1;

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
        {levels.map((level) => {
          const top = 7 + ((maximum - (level.value as number)) / range) * 86;
          return (
            <div
              className={`price-marker price-${level.kind}`}
              style={{ top: `${top}%` }}
              key={level.label}
            >
              <span>{level.label}</span>
              <i aria-hidden="true" />
              <strong>{level.value}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
