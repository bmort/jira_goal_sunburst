import { AppConfig } from "@server/config";
import { JiraClient, JiraIssue, JiraIssueLink } from "@server/lib/jira-client";
import { JiraError, TraversalLimitError } from "@server/lib/errors";
import {
  IssueMeta,
  IssueType,
  StatusCategory,
  SunburstFilters,
  SunburstPathNode,
  SunburstResponse
} from "@shared/types";

interface BuildOptions {
  filters: SunburstFilters;
}

interface BuildContext {
  config: AppConfig;
  jira: JiraClient;
  startTime: number;
}

const STATUS_NAME_TO_CATEGORY: Record<string, StatusCategory> = {
  "to do": "To Do",
  "in progress": "In Progress",
  done: "Done"
};

const RING3_TYPES: IssueType[] = ["Feature", "Story", "Enabler", "Spike"];

export async function buildSunburst(
  ctx: BuildContext,
  options: BuildOptions
): Promise<SunburstResponse> {
  const { filters } = options;
  const { config, jira } = ctx;
  const deadline = ctx.startTime + config.jira.traversalTimeoutMs;
  const browseBaseUrl = `${config.jira.baseUrl.replace(/\/$/, "")}/browse`;

  ensureTraversalBudget(deadline);

  const goalIssues = await jira.searchIssues(
    `project = TPO AND issuetype = Goal AND fixVersion = \"${filters.pi}\"`
  );

  ensureTraversalBudget(deadline);

  const goals = goalIssues
    .map(toIssueMeta)
    .filter((meta): meta is IssueMetaWithLinks => !!meta);

  if (goals.length === 0) {
    return {
      pi: filters.pi,
      truncated: false,
      nodes: [],
      meta: { issues: {} },
      browseBaseUrl,
      warnings: []
    };
  }

  const goalImpactMap = new Map<string, Set<string>>();
  const allImpactKeys = new Set<string>();

  for (const goal of goals) {
    const linked = collectLinks(goal.raw, {
      outward: "is achieved through",
      inward: "helps achieve"
    });

    goalImpactMap.set(goal.key, new Set(linked));
    linked.forEach((key) => allImpactKeys.add(key));
  }

  ensureTraversalBudget(deadline);

  const impacts = (await jira.fetchIssuesByKeys(Array.from(allImpactKeys)))
    .map(toIssueMeta)
    .filter((meta): meta is IssueMetaWithLinks => !!meta && meta.type === "Impact");

  const impactMap = new Map<string, IssueMetaWithLinks>();
  for (const impact of impacts) {
    impactMap.set(impact.key, impact);
  }

  const impactFeatureMap = new Map<string, Set<string>>();
  const allFeatureKeys = new Set<string>();

  for (const goalKey of goalImpactMap.keys()) {
    const impactKeys = goalImpactMap.get(goalKey);
    if (!impactKeys) continue;

    const filtered = Array.from(impactKeys).filter((key) => impactMap.has(key));
    goalImpactMap.set(goalKey, new Set(filtered));

    for (const impactKey of filtered) {
      const impact = impactMap.get(impactKey);
      if (!impact) continue;

      const linked = collectLinks(impact.raw, {
        outward: "realises",
        inward: "realised by"
      });

      impactFeatureMap.set(impact.key, new Set(linked));
      linked.forEach((key) => allFeatureKeys.add(key));
    }
  }

  ensureTraversalBudget(deadline);

  const features = (await jira.fetchIssuesByKeys(Array.from(allFeatureKeys)))
    .map(toIssueMeta)
    .filter(
      (meta): meta is IssueMetaWithLinks =>
        !!meta && (RING3_TYPES as IssueType[]).includes(meta.type)
    );

  const featureMap = new Map<string, IssueMetaWithLinks>();
  for (const feature of features) {
    featureMap.set(feature.key, feature);
  }

  const featureObjectiveMap = new Map<string, Set<string>>();
  const allObjectiveKeys = new Set<string>();

  for (const impactKey of impactFeatureMap.keys()) {
    const featureKeys = impactFeatureMap.get(impactKey);
    if (!featureKeys) continue;

    const filtered = Array.from(featureKeys).filter((key) => featureMap.has(key));
    impactFeatureMap.set(impactKey, new Set(filtered));

    for (const featureKey of filtered) {
      const feature = featureMap.get(featureKey);
      if (!feature) continue;

      const linked = collectLinks(feature.raw, {
        outward: "relates to",
        inward: "relates to"
      });

      featureObjectiveMap.set(feature.key, new Set(linked));
      linked.forEach((key) => allObjectiveKeys.add(key));
    }
  }

  ensureTraversalBudget(deadline);

  const objectives = (await jira.fetchIssuesByKeys(Array.from(allObjectiveKeys)))
    .map(toIssueMeta)
    .filter((meta): meta is IssueMetaWithLinks => !!meta && meta.type === "Objective");

  const objectiveMap = new Map<string, IssueMetaWithLinks>();
  for (const objective of objectives) {
    objectiveMap.set(objective.key, objective);
  }

  for (const featureKey of featureObjectiveMap.keys()) {
    const objectiveKeys = Array.from(featureObjectiveMap.get(featureKey) ?? []);
    const filtered = objectiveKeys.filter((key) => objectiveMap.has(key));
    featureObjectiveMap.set(featureKey, new Set(filtered));
  }

  const nodes: SunburstPathNode[] = [];
  const metaIssues: Record<string, IssueMeta> = {};
  let truncated = false;

  const pushNode = (path: string[], issue: IssueMetaWithLinks) => {
    if (nodes.length >= config.limits.maxNodes) {
      truncated = true;
      throw new TraversalLimitError("Node cap reached");
    }

    if (!metaIssues[issue.key]) {
      metaIssues[issue.key] = toPublicMeta(issue);
    }

    nodes.push({
      path,
      id: issue.key,
      label: `${issue.key} · ${issue.type}`,
      statusCategory: issue.statusCategory
    });
  };

  try {
    for (const goal of goals) {
      const goalPath = [filters.pi, goal.key];
      pushNode(goalPath, goal);

      const impactKeys = Array.from(goalImpactMap.get(goal.key) ?? []);

      if (impactKeys.length === 0) {
        continue;
      }

      for (const impactKey of impactKeys) {
        const impact = impactMap.get(impactKey);
        if (!impact) continue;

        const impactPath = [filters.pi, goal.key, impact.key];
        pushNode(impactPath, impact);

        const featureKeys = Array.from(impactFeatureMap.get(impact.key) ?? []);

        if (featureKeys.length === 0) {
          continue;
        }

        for (const featureKey of featureKeys) {
          const feature = featureMap.get(featureKey);
          if (!feature) continue;

          const featurePath = [filters.pi, goal.key, impact.key, feature.key];
          pushNode(featurePath, feature);

          const objectiveKeys = Array.from(
            featureObjectiveMap.get(feature.key) ?? []
          );

          if (objectiveKeys.length === 0) {
            continue;
          }

          for (const objectiveKey of objectiveKeys) {
            const objective = objectiveMap.get(objectiveKey);
            if (!objective) continue;

            const objectivePath = [
              filters.pi,
              goal.key,
              impact.key,
              feature.key,
              objective.key
            ];
            pushNode(objectivePath, objective);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof TraversalLimitError) {
      truncated = true;
    } else {
      throw error;
    }
  }

  return {
    pi: filters.pi,
    truncated,
    nodes,
    meta: {
      issues: metaIssues
    },
    browseBaseUrl,
    warnings: truncated
      ? ["Too many nodes; showing first 1,500"]
      : []
  };
}

interface IssueMetaWithLinks extends IssueMeta {
  raw: JiraIssue;
}

function toIssueMeta(issue: JiraIssue): IssueMetaWithLinks | null {
  const typeName = issue.fields.issuetype?.name;
  const normalizedType = normalizeIssueType(typeName);

  if (!normalizedType) {
    return null;
  }

  const statusName = issue.fields.status?.statusCategory?.name;
  const statusCategory = normalizeStatus(statusName);

  if (!statusCategory) {
    return null;
  }

  return {
    raw: issue,
    key: issue.key,
    type: normalizedType,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory,
    project: issue.fields.project?.key ?? "",
    fixVersions: (issue.fields.fixVersions ?? []).map((version) => version.name ?? ""),
    assignee: issue.fields.assignee?.displayName ?? undefined,
    telescope: extractTelescopes(issue.fields.customfield_12001)
  };
}

function toPublicMeta(issue: IssueMetaWithLinks): IssueMeta {
  const { raw: _raw, ...rest } = issue;
  return rest;
}

function normalizeStatus(name?: string | null): StatusCategory | null {
  if (!name) return null;
  const normalized = STATUS_NAME_TO_CATEGORY[name.toLowerCase()];
  return normalized ?? null;
}

function normalizeIssueType(type?: string | null): IssueType | null {
  if (!type) return null;
  const lower = type.toLowerCase();

  if (lower.includes("goal")) return "Goal";
  if (lower.includes("impact")) return "Impact";
  if (lower.includes("feature")) return "Feature";
  if (lower.includes("story")) return "Story";
  if (lower.includes("enabler")) return "Enabler";
  if (lower.includes("spike")) return "Spike";
  if (lower.includes("objective")) return "Objective";
  if (lower.includes("capability")) return "Feature";
  if (lower.includes("program backlog")) return "Feature";
  if (lower.includes("programme backlog")) return "Feature";
  if (lower.includes("pbi")) return "Feature";
  if (lower.includes("backlog item")) return "Feature";

  return null;
}

function extractTelescopes(values: { value: string }[] | null | undefined): string[] {
  if (!values) {
    return [];
  }

  return values
    .map((entry) => entry?.value?.trim())
    .filter((value): value is string => Boolean(value));
}

interface LinkMatcher {
  outward: string;
  inward: string;
}

function collectLinks(issue: JiraIssue, matcher: LinkMatcher): string[] {
  const links = issue.fields.issuelinks ?? [];
  const keys: string[] = [];

  for (const link of links) {
    const candidate = getLinkedIssueKey(link, issue.key, matcher);
    if (candidate) {
      keys.push(candidate);
    }
  }

  return keys;
}

function getLinkedIssueKey(
  link: JiraIssueLink,
  currentKey: string,
  matcher: LinkMatcher
): string | null {
  if (
    namesMatch(link.type?.outward, matcher.outward) &&
    link.outwardIssue?.key
  ) {
    if (link.outwardIssue.key !== currentKey) {
      return link.outwardIssue.key;
    }
  }

  if (namesMatch(link.type?.inward, matcher.inward) && link.inwardIssue?.key) {
    if (link.inwardIssue.key !== currentKey) {
      return link.inwardIssue.key;
    }
  }

  return null;
}

function ensureTraversalBudget(deadline: number) {
  if (Date.now() > deadline) {
    throw new JiraError("Jira traversal timeout", 504);
  }
}

function namesMatch(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const normalizedActual = normalizeLinkName(actual);
  const normalizedExpected = normalizeLinkName(expected);

  if (normalizedActual === normalizedExpected) {
    return true;
  }

  if (normalizedActual.includes(normalizedExpected)) {
    return true;
  }

  if (normalizedExpected.includes(normalizedActual)) {
    return true;
  }

  return false;
}

function normalizeLinkName(value: string): string {
  let normalized = value.trim().toLowerCase();

  if (normalized.startsWith("is ")) {
    normalized = normalized.slice(3);
  }

  normalized = normalized.replace(/realized/g, "realised");
  normalized = normalized.replace(/achieves/g, "achieve");
  normalized = normalized.replace(/helps to/g, "helps");
  normalized = normalized.replace(/\s+/g, " ");

  return normalized;
}
