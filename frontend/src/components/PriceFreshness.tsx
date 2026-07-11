export const AUTOMATIC_PRICE_STALE_SECONDS = 120;

interface PriceFreshnessProps {
  source: string | null;
  updatedAt: string | null;
  now?: Date;
}

function sourceLabel(source: string): string {
  return source === "manual" ? "Manual" : source.charAt(0).toUpperCase() + source.slice(1);
}

export function PriceFreshness({ source, updatedAt, now = new Date() }: PriceFreshnessProps) {
  if (!source || !updatedAt) return <small className="price-freshness unavailable">No price recorded</small>;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return <small className="price-freshness unavailable">No price recorded</small>;
  if (source === "manual") {
    return <small className="price-freshness manual">Manual · updated at {updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>;
  }
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - updated.getTime()) / 1000));
  const age = ageSeconds < 60 ? `${ageSeconds} seconds` : `${Math.floor(ageSeconds / 60)} minutes`;
  const stale = ageSeconds > AUTOMATIC_PRICE_STALE_SECONDS;
  return <small className={`price-freshness ${stale ? "stale" : "current"}`}>{`${stale ? "Stale" : sourceLabel(source)} · updated ${age} ago`}</small>;
}
