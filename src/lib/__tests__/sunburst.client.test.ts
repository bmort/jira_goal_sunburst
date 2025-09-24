import { describe, expect, it } from "vitest";

import { buildHierarchy } from "@/lib/sunburst";

describe("buildHierarchy client", () => {
  it("normalizes first-ring wedges", () => {
    const response = {
      pi: "PI28",
      truncated: false,
      warnings: [],
      nodes: [
        { path: ["PI28", "G-1"], id: "G-1", label: "G-1", statusCategory: "In Progress" },
        { path: ["PI28", "G-1", "I-1"], id: "I-1", label: "I-1", statusCategory: "In Progress" },
        { path: ["PI28", "G-1", "I-1", "F-1"], id: "F-1", label: "F-1", statusCategory: "Done" },
        { path: ["PI28", "G-2"], id: "G-2", label: "G-2", statusCategory: "In Progress" },
        { path: ["PI28", "G-2", "I-2"], id: "I-2", label: "I-2", statusCategory: "In Progress" },
        { path: ["PI28", "G-2", "I-2", "F-2"], id: "F-2", label: "F-2", statusCategory: "Done" },
        { path: ["PI28", "G-3"], id: "G-3", label: "G-3", statusCategory: "In Progress" }
      ],
      meta: {
        issues: {
          "G-1": {
            key: "G-1",
            type: "Goal",
            summary: "Goal 1",
            status: "In Progress",
            statusCategory: "In Progress",
            project: "TPO",
            fixVersions: [],
            assignee: undefined
          },
          "I-1": {
            key: "I-1",
            type: "Impact",
            summary: "Impact 1",
            status: "In Progress",
            statusCategory: "In Progress",
            project: "TPO",
            fixVersions: [],
            assignee: undefined
          },
          "F-1": {
            key: "F-1",
            type: "Feature",
            summary: "Feature 1",
            status: "Done",
            statusCategory: "Done",
            project: "SP",
            fixVersions: [],
            assignee: undefined
          },
          "G-2": {
            key: "G-2",
            type: "Goal",
            summary: "Goal 2",
            status: "In Progress",
            statusCategory: "In Progress",
            project: "TPO",
            fixVersions: [],
            assignee: undefined
          },
          "I-2": {
            key: "I-2",
            type: "Impact",
            summary: "Impact 2",
            status: "In Progress",
            statusCategory: "In Progress",
            project: "TPO",
            fixVersions: [],
            assignee: undefined
          },
          "F-2": {
            key: "F-2",
            type: "Feature",
            summary: "Feature 2",
            status: "Done",
            statusCategory: "Done",
            project: "SP",
            fixVersions: [],
            assignee: undefined
          },
          "G-3": {
            key: "G-3",
            type: "Goal",
            summary: "Goal 3",
            status: "In Progress",
            statusCategory: "In Progress",
            project: "TPO",
            fixVersions: [],
            assignee: undefined
          }
        }
      }
    } as any;

    const hierarchy = buildHierarchy(response);
    expect(hierarchy?.value).toBe(3);
    expect(hierarchy?.children?.map((child) => Number(child.value.toFixed(5)))).toEqual([1, 1, 1]);
  });
});
