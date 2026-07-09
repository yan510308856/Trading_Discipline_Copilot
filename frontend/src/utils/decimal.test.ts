import { describe, expect, it } from "vitest";

import {
  formatDecimal,
  formatDecimalInput,
  parseDecimalInput,
  roundToTwoDecimals,
} from "./decimal";

describe("decimal helpers", () => {
  it("rounds floating point artifacts to two decimals", () => {
    expect(roundToTwoDecimals(1.999999999)).toBe(2);
    expect(roundToTwoDecimals(0.30000000004)).toBe(0.3);
  });

  it("parses decimal input without requiring filled text", () => {
    expect(parseDecimalInput("123.456")).toBe(123.46);
    expect(parseDecimalInput("")).toBeNull();
  });

  it("formats values to two decimals", () => {
    expect(formatDecimal(123)).toBe("123.00");
    expect(formatDecimalInput("123.4")).toBe("123.40");
  });
});
