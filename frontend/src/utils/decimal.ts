export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? roundToTwoDecimals(parsed) : null;
}

export function formatDecimal(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toFixed(2);
}

export function formatDecimalInput(value: string): string {
  const parsed = parseDecimalInput(value);
  return parsed === null ? value : formatDecimal(parsed);
}
