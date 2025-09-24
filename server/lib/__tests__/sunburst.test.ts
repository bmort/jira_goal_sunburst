import { describe, expect, it } from "vitest";

import { buildSunburst } from "@server/lib/sunburst";
import type { AppConfig } from "@server/config";
import type { JiraIssue, JiraIssueLink, JiraVersion } from "@server/lib/jira-client";
import type { SunburstFilters } from "@shared/types";

describe("buildSunburst", () => {
  it("includes ring-3 issues linked via 'realised by' even with variant labels", async () => {
    const fixtures = createFixtures();

    const jira = {
      async searchIssues(jql: string): Promise<JiraIssue[]> {
        if (jql.includes("issuetype = Goal") && jql.includes("TPO")) {
          return [fixtures.goal];
        }

        const keys = extractKeysFromJql(jql);
        return keys.map((key) => fixtures.allIssues[key]).filter(Boolean);
      },
      async fetchIssuesByKeys(keys: string[]): Promise<JiraIssue[]> {
        return keys.map((key) => fixtures.allIssues[key]).filter(Boolean);
      },
      async getProjectVersions(_project: string): Promise<JiraVersion[]> {
        return [];
      }
    } as unknown as { searchIssues: (jql: string) => Promise<JiraIssue[]>; fetchIssuesByKeys: (keys: string[]) => Promise<JiraIssue[]>; getProjectVersions: (project: string) => Promise<JiraVersion[]> };

    const config = createConfig();

    const filters: SunburstFilters = {
      pi: "PI30"
    };

    const result = await buildSunburst(
      {
        config,
        jira: jira as any,
        startTime: Date.now()
      },
      { filters }
    );

    const firstRingValues = result.nodes
      .filter((node) => node.path.length === 2)
      .map((node) => node.path[1]);

    expect(new Set(firstRingValues).size).toBe(firstRingValues.length);

    const storyPath = result.nodes.find((node) =>
      node.path.length === 4 && node.path.includes("SP-2001")
    );

    const backlogPath = result.nodes.find((node) =>
      node.path.length === 4 && node.path.includes("SP-5964")
    );

    expect(storyPath, "expected ring-3 Story to be present in traversal").toBeDefined();
    expect(backlogPath, "expected Program Backlog item to be present in traversal").toBeDefined();
    expect(result.meta.issues["SP-2001"], "Story metadata should be retained").toBeDefined();
    expect(result.meta.issues["SP-5964"], "Program Backlog metadata should be retained").toBeDefined();
  });
});

function createConfig(): AppConfig {
  return {
    port: 8080,
    appOrigins: ["http://localhost:5173"],
    nodeEnv: "test",
    jira: {
      baseUrl: "https://jira.example.com",
      token: "test-token",
      rejectUnauthorized: true,
      requestTimeoutMs: 10_000,
      traversalTimeoutMs: 30_000
    },
    limits: {
      maxNodes: 1_500,
      versionCacheTtlMs: 300_000
    }
  };
}

function createFixtures() {
  const impactLinkStory: JiraIssueLink = {
    type: {
      name: "Realised by (SP)",
      outward: "Realised by (delivery)",
      inward: "realises"
    },
    outwardIssue: {
      key: "SP-2001"
    }
  };

  const impactLinkBacklog: JiraIssueLink = {
    type: {
      name: "Realised by (SP)",
      outward: "is realised by backlog",
      inward: "realises"
    },
    outwardIssue: {
      key: "SP-5964"
    }
  };

  const featureLink: JiraIssueLink = {
    type: {
      name: "relates to",
      outward: "relates to",
      inward: "relates to"
    },
    outwardIssue: {
      key: "SPO-3001"
    }
  };

  const goal: JiraIssue = {
    id: "10000",
    key: "TPO-1042",
    fields: {
      summary: "Goal under test",
      issuetype: { name: "Goal" },
      status: {
        name: "In Progress",
        statusCategory: { name: "In Progress", key: "indeterminate" }
      },
      project: { key: "TPO", name: "TPO" },
      fixVersions: [{ id: "1", name: "PI30", released: false }],
      issuelinks: [
        {
          type: {
            name: "achieved through",
            outward: "is achieved through",
            inward: "helps achieve"
          },
          outwardIssue: {
            key: "TPO-IMP-200"
          }
        }
      ],
      customfield_12001: [{ value: "Observatory" }]
    }
  } as unknown as JiraIssue;

  const impact: JiraIssue = {
    id: "10001",
    key: "TPO-IMP-200",
    fields: {
      summary: "Impact linked to goal",
      issuetype: { name: "Impact" },
      status: {
        name: "To Do",
        statusCategory: { name: "To Do", key: "new" }
      },
      project: { key: "TPO", name: "TPO" },
      fixVersions: [],
      issuelinks: [impactLinkStory, impactLinkBacklog],
      customfield_12001: null
    }
  } as unknown as JiraIssue;

  const feature: JiraIssue = {
    id: "10002",
    key: "SP-2001",
    fields: {
      summary: "Story linked to impact",
      issuetype: { name: "Story" },
      status: {
        name: "Done",
        statusCategory: { name: "Done", key: "done" }
      },
      project: { key: "SP", name: "SP" },
      fixVersions: [],
      issuelinks: [featureLink],
      customfield_12001: null
    }
  } as unknown as JiraIssue;

  const objective: JiraIssue = {
    id: "10003",
    key: "SPO-3001",
    fields: {
      summary: "Objective linked to feature",
      issuetype: { name: "Objective" },
      status: {
        name: "In Progress",
        statusCategory: { name: "In Progress", key: "indeterminate" }
      },
      project: { key: "SPO", name: "SPO" },
      fixVersions: [],
      issuelinks: [],
      customfield_12001: null
    }
  } as unknown as JiraIssue;

  const backlogItem: JiraIssue = {
    id: "10004",
    key: "SP-5964",
    fields: {
      summary: "Program backlog item children",
      issuetype: { name: "Program Backlog Item" },
      status: {
        name: "Implementing",
        statusCategory: { name: "In Progress", key: "indeterminate" }
      },
      project: { key: "SP", name: "SP" },
      fixVersions: [],
      issuelinks: [],
      customfield_12001: null
    }
  } as unknown as JiraIssue;

  const allIssues: Record<string, JiraIssue> = {
    [goal.key]: goal,
    [impact.key]: impact,
    [feature.key]: feature,
    [backlogItem.key]: backlogItem,
    [objective.key]: objective
  };

  return {
    goal,
    allIssues,
    backlogItem
  };
}

function extractKeysFromJql(jql: string): string[] {
  const match = /key in \(([^)]+)\)/i.exec(jql);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((segment) => segment.replace(/["']/g, "").trim())
    .filter(Boolean);
}
