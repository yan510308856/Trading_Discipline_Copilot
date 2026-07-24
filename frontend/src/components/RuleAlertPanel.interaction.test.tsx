// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuleAlert } from "../types";
import { RuleAlertPanel } from "./RuleAlertPanel";

const warning: RuleAlert = {
  rule_id: "runner_must_have_protection",
  severity: "warning",
  message: "Runner needs protection.",
  checklist: [],
  discipline_sentence: "",
  dismissible: true,
  dismissal_key: "warning:key",
  occurrence_key: "occurrence:key",
};

afterEach(cleanup);

describe("RuleAlertPanel dismissal controls", () => {
  it("dismisses an open-trade warning with one keyboard-accessible button", () => {
    const onDismiss = vi.fn();
    render(<RuleAlertPanel status="warning" alerts={[warning]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss warning" }));
    expect(onDismiss).toHaveBeenCalledWith(warning);
  });

  it("never shows the control for blockers or pre-trade warning gates", () => {
    const { rerender } = render(<RuleAlertPanel status="blocked" alerts={[{ ...warning, severity: "blocker", dismissible: false }]} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
    rerender(<RuleAlertPanel status="warning" alerts={[warning]} />);
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
  });
});
