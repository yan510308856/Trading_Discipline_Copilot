import { describe, expect, it } from "vitest";

import {
  readinessProgressText,
  readinessStatusLabel,
  readinessStatusMessage,
} from "./readiness";

describe("readiness copy helpers", () => {
  it("formats required readiness progress", () => {
    expect(readinessProgressText(3, 5)).toBe(
      "3 / 5 required items complete.",
    );
  });

  it("keeps clear labels for the three readiness states", () => {
    expect(readinessStatusLabel.not_cleared).toBe("Not cleared");
    expect(readinessStatusLabel.partially_ready).toBe("Partially ready");
    expect(readinessStatusLabel.cleared).toBe("Cleared");
  });

  it("explains that cleared still requires pre-trade rules", () => {
    expect(readinessStatusMessage.cleared).toContain("pre-trade rules");
  });
});
