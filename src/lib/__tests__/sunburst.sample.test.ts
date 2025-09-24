import { describe, expect, it } from "vitest";

import { extractRelationships, buildHierarchy } from "@/lib/sunburst";
import type { SunburstResponse } from "@shared/types";
import sampleResponse from "../../../test_data.json";

const fixture = sampleResponse as SunburstResponse;

describe("sunburst client fixture", () => {
  it("builds a stable hierarchy from the PI28 fixture", () => {
    const hierarchy = buildHierarchy(fixture);

    expect(hierarchy).not.toBeNull();
    expect(hierarchy?.id).toBe(fixture.pi);

    const goalKeys = new Set<string>();
    for (const node of fixture.nodes) {
      if (node.path.length >= 2) {
        goalKeys.add(node.path[1]);
      }
    }

    expect(hierarchy?.children?.length).toBe(goalKeys.size);
    const firstRingValues = hierarchy?.children?.map((child) => child.value) ?? [];
    const uniqueFirstRingValues = Array.from(new Set(firstRingValues));
    expect(uniqueFirstRingValues).toEqual([1]);
  });

  it("derives parent/child relationships from the fixture", () => {
    const targetKey = "SP-5757";

    const expectedParents = new Set<string>();
    const expectedChildren = new Set<string>();

    for (const node of fixture.nodes) {
      const index = node.path.indexOf(targetKey);
      if (index === -1) {
        continue;
      }

      if (index > 0) {
        expectedParents.add(node.path[index - 1]);
      }

      if (index < node.path.length - 1) {
        expectedChildren.add(node.path[index + 1]);
      }
    }

    expectedParents.delete(fixture.pi);
    expectedChildren.delete(fixture.pi);

    const { parents, children } = extractRelationships(fixture, targetKey);

    const parentKeys = parents.map((meta) => meta.key).sort();
    const childKeys = children.map((meta) => meta.key).sort();

    expect(parentKeys).toEqual(Array.from(expectedParents).sort());
    expect(childKeys).toEqual(Array.from(expectedChildren).sort());
  });
});
