import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";
import { Field } from "./Field";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

describe("small UI primitives", () => {
  it("renders button variants with existing classes", () => {
    const html = renderToString(<Button variant="primary">Save</Button>);

    expect(html).toContain("primary-button");
    expect(html).toContain("Save");
  });

  it("renders status badge variants", () => {
    const html = renderToString(
      <StatusBadge variant="blocked">Blocked</StatusBadge>,
    );

    expect(html).toContain("status-badge");
    expect(html).toContain("status-blocked");
    expect(html).toContain("Blocked");
  });

  it("renders panel and field wrappers", () => {
    const html = renderToString(
      <Panel>
        <Field>Label</Field>
      </Panel>,
    );

    expect(html).toContain("panel");
    expect(html).toContain("field");
  });
});
