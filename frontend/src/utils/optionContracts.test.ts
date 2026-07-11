import { describe, expect, it } from "vitest";
import { optionContractSummary, strikeSuggestions, upcomingOptionExpirations } from "./optionContracts";

describe("option contract planning utilities", () => {
  it("suggests Fridays for swing planning", () => {
    expect(upcomingOptionExpirations("swing", new Date("2026-07-06T12:00:00Z"))[0]).toBe("2026-07-10");
  });

  it("suggests third-Friday January expirations for LEAPs", () => {
    expect(upcomingOptionExpirations("leap", new Date("2026-07-06T12:00:00Z"))).toEqual([
      "2027-01-15", "2028-01-21", "2029-01-19",
    ]);
  });

  it("builds a canonical contract and strikes around ATM", () => {
    expect(optionContractSummary("aapl", "2027-01-15", 200, "call")).toBe("AAPL 2027-01-15 200C");
    expect(strikeSuggestions(201, 5)).toContain(200);
  });
});
