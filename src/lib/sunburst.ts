import { IssueMeta, StatusCategory, SunburstResponse } from "@shared/types";
import { getStatusColor } from "@/lib/colors";

export interface SunburstChartNode {
  id: string;
  name: string;
  value: number;
  color?: string;
  children: SunburstChartNode[];
  data?: {
    issueKey?: string;
    statusCategory?: StatusCategory;
    status?: string;
    label?: string;
    path: string[];
    type?: string;
    assignee?: string;
    depth: number;
  };
}

export interface IssueRelationships {
  parents: IssueMeta[];
  children: IssueMeta[];
}

export function buildHierarchy(response?: SunburstResponse): SunburstChartNode | null {
  if (!response) return null;

  const root: SunburstChartNode = {
    id: response.pi,
    name: response.pi,
    value: 0,
    color: "#1E293B",
    children: [],
    data: {
      path: [response.pi],
      depth: 0
    }
  };

  const nodeIndex = new Map<string, SunburstChartNode>();
  nodeIndex.set(response.pi, root);

  const sortedNodes = [...response.nodes].sort(
    (a, b) => a.path.length - b.path.length
  );

  for (const node of sortedNodes) {
    let parent = root;

    for (let level = 1; level < node.path.length; level++) {
      const slice = node.path.slice(0, level + 1);
      const pathKey = slice.join("|");
      let current = nodeIndex.get(pathKey);

      if (!current) {
        const issueKey = slice[level];
        const meta = response.meta.issues[issueKey];
        const depth = slice.length - 1;

        current = {
          id: pathKey,
          name: meta?.key ?? issueKey,
          value: 0,
          color: getStatusColor(meta?.statusCategory, meta?.status),
          children: [],
          data: {
            issueKey: meta?.key,
            statusCategory: meta?.statusCategory,
            status: meta?.status,
            assignee: meta?.assignee,
            label: meta ? `${meta.key} · ${meta.type}` : issueKey,
            path: slice,
            type: meta?.type,
            depth
          }
        };

        parent.children.push(current);
        nodeIndex.set(pathKey, current);
      }

      if (level === node.path.length - 1) {
        current.value += 1;
      }

      parent = current;
    }
  }

  propagateValues(root);
  equalizeFirstRing(root);
  updateRootValue(root);
  pruneEmptyNodes(root);

  return root;
}

export function extractRelationships(
  response: SunburstResponse | undefined,
  issueKey: string
): IssueRelationships {
  if (!response) {
    return { parents: [], children: [] };
  }

  const parents = new Set<string>();
  const children = new Set<string>();

  for (const node of response.nodes) {
    const index = node.path.indexOf(issueKey);
    if (index === -1) {
      continue;
    }

    if (index > 1) {
      const parentKey = node.path[index - 1];
      if (parentKey !== response.pi) {
        parents.add(parentKey);
      }
    }

    if (index < node.path.length - 1) {
      const childKey = node.path[index + 1];
      if (childKey !== response.pi) {
        children.add(childKey);
      }
    }
  }

  const parentMetas = keysToMeta(response, Array.from(parents));
  const childMetas = keysToMeta(response, Array.from(children));

  return {
    parents: parentMetas,
    children: childMetas
  };
}

function keysToMeta(response: SunburstResponse, keys: string[]): IssueMeta[] {
  const map = response.meta.issues;
  const metas: IssueMeta[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) continue;
    const meta = map[key];
    if (meta) {
      metas.push(meta);
      seen.add(key);
    }
  }

  return metas;
}

function propagateValues(node: SunburstChartNode): number {
  node.children = node.children ?? [];

  if (node.children.length === 0) {
    return node.value;
  }

  let total = 0;
  for (const child of node.children) {
    total += propagateValues(child);
  }

  node.value = total;
  return total;
}

function pruneEmptyNodes(node: SunburstChartNode) {
  node.children = node.children.filter((child) => child.value > 0);
  for (const child of node.children) {
    pruneEmptyNodes(child);
  }
}

function equalizeFirstRing(root: SunburstChartNode) {
  if (!root.children || root.children.length === 0 || root.value === 0) {
    return;
  }

  for (const child of root.children) {
    if (child.value <= 0) {
      child.value = 1;
      continue;
    }

    const factor = 1 / child.value;
    scaleSubtree(child, factor);
    child.value = 1;
  }
}

function scaleSubtree(node: SunburstChartNode, factor: number) {
  node.value *= factor;
  for (const child of node.children ?? []) {
    scaleSubtree(child, factor);
  }
}

function updateRootValue(root: SunburstChartNode) {
  if (!root.children || root.children.length === 0) {
    return;
  }

  root.value = root.children.reduce((sum, child) => sum + child.value, 0);
}
