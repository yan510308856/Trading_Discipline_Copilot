import type { DailySummaryData } from "../types";


function formatR(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}


export function SummaryCards({ summary }: { summary: DailySummaryData }) {
  const cards = [
    ["Trades", summary.total_trades.toString()],
    ["Net result", formatR(summary.net_r)],
    [
      "Average discipline",
      summary.average_discipline_score === null
        ? "Not scored"
        : summary.average_discipline_score.toFixed(1),
    ],
    ["Warnings / violations", summary.warning_violation_count.toString()],
    ["Green-to-red", summary.green_to_red_count.toString()],
    ["Revenge trades", summary.revenge_trade_count.toString()],
  ];

  return (
    <div className="summary-card-grid">
      {cards.map(([label, value]) => (
        <article className="summary-metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}
