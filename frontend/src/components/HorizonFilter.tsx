import type { TradeHorizon } from "../types";

export type HorizonFilterValue = "all" | TradeHorizon;

interface HorizonFilterProps {
  value: HorizonFilterValue;
  onChange: (value: HorizonFilterValue) => void;
  label?: string;
}

export function horizonForApi(value: HorizonFilterValue): TradeHorizon | undefined {
  return value === "all" ? undefined : value;
}

export function HorizonFilter({
  value,
  onChange,
  label = "Trade horizon",
}: HorizonFilterProps) {
  return (
    <label className="horizon-filter">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as HorizonFilterValue)}
      >
        <option value="all">All</option>
        <option value="intraday">Intraday</option>
        <option value="swing">Swing</option>
        <option value="other">Other</option>
      </select>
    </label>
  );
}
