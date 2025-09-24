import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailsSidebar } from "@/components/DetailsSidebar";
import type { SunburstResponse } from "@shared/types";
import sampleResponse from "../../../test_data.json";

const fixture = sampleResponse as SunburstResponse;

describe("DetailsSidebar", () => {
  it("renders an empty prompt when nothing is selected", () => {
    const html = renderToStaticMarkup(
      <DetailsSidebar data={fixture} selectedKey={null} onClose={vi.fn()} />
    );

    expect(html).toContain("Select a wedge to see details");
  });

  it("shows metadata, Jira link, and relationships for a selected node", () => {
    const targetKey = "SP-5757";
    const html = renderToStaticMarkup(
      <DetailsSidebar data={fixture} selectedKey={targetKey} onClose={vi.fn()} />
    );

    const meta = fixture.meta.issues[targetKey];
    expect(meta).toBeDefined();

    expect(html).toContain(meta.key);
    expect(html).toContain(meta.summary);
    expect(html).toContain(meta.status);

    if (meta.assignee) {
      expect(html).toContain(meta.assignee);
    }

    const jiraUrl = `${fixture.browseBaseUrl.replace(/\/$/, "")}/${meta.key}`;
    expect(html).toContain(jiraUrl);

    const parents = new Set<string>();
    const children = new Set<string>();
    for (const node of fixture.nodes) {
      const index = node.path.indexOf(meta.key);
      if (index === -1) continue;
      if (index > 0) parents.add(node.path[index - 1]);
      if (index < node.path.length - 1) children.add(node.path[index + 1]);
    }

    parents.delete(fixture.pi);
    children.delete(fixture.pi);

    for (const key of parents) {
      expect(html).toContain(key);
    }

    for (const key of children) {
      expect(html).toContain(key);
    }
  });
});
