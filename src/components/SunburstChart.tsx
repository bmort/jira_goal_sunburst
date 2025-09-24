import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sunburst from "sunburst-chart";

import { SunburstResponse } from "@shared/types";
import { buildHierarchy, SunburstChartNode } from "@/lib/sunburst";
import { getStatusColor, getStatusLabelColor } from "@/lib/colors";

// Minimal API shape we use from sunburst-chart to avoid ReturnType<> typing issues
type SunburstApi = {
  (el: HTMLElement): void;
  data(d?: unknown): SunburstApi;
  width(w?: number): SunburstApi;
  height(h?: number): SunburstApi;
  focusOnNode(node: unknown | null): SunburstApi;
  label(fn: (n: SunburstChartNode) => string): SunburstApi;
  size(field: string): SunburstApi;
  color(fn: (n: SunburstChartNode) => string): SunburstApi;
  tooltipTitle(fn: (n: SunburstChartNode) => string): SunburstApi;
  tooltipContent(fn: (n: SunburstChartNode) => string): SunburstApi;
  onClick(fn: (n: SunburstChartNode | null) => void): SunburstApi;
  minSliceAngle(v: number): SunburstApi;
  excludeRoot(v: boolean): SunburstApi;
  radiusScaleExponent(v: number): SunburstApi;
  showLabels(v: boolean): SunburstApi;
  maxLevels(v: number): SunburstApi;
};

interface SunburstChartProps {
  data?: SunburstResponse;
  isLoading: boolean;
  error?: string | null;
  onSelect: (issueKey: string | null) => void;
}

const MIN_CHART_SIZE = 420;

export function SunburstChart({ data, isLoading, error, onSelect }: SunburstChartProps) {
  const logDebug = useCallback(
    (...values: unknown[]) => {
      if (import.meta.env.DEV) {
        console.log("[sunburst:chart]", ...values);
      }
    },
    []
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<SunburstApi | null>(null);
  const sizeRef = useRef<number | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);
  const activePathRef = useRef<string[]>([]);

  // Debug helpers: count expected unique nodes per level from both response and built hierarchy
  const countLevelsFromResponse = useCallback((resp?: SunburstResponse) => {
    if (!resp) return {};
    const levelSets = new Map<number, Set<string>>();
    levelSets.set(0, new Set([resp.pi]));
    for (const n of resp.nodes) {
      for (let i = 1; i < n.path.length; i++) {
        const key = n.path[i];
        let set = levelSets.get(i);
        if (!set) {
          set = new Set<string>();
          levelSets.set(i, set);
        }
        set.add(key);
      }
    }
    const out: Record<number, number> = {};
    for (const [lvl, set] of levelSets) out[lvl] = set.size;
    return out;
  }, []);

  const countLevelsFromHierarchy = useCallback((root?: SunburstChartNode | null) => {
    if (!root) return {};
    const out: Record<number, number> = {};
    const q: Array<{ node: SunburstChartNode; depth: number }> = [{ node: root, depth: 0 }];
    while (q.length) {
      const { node, depth } = q.shift()!;
      out[depth] = (out[depth] ?? 0) + 1;
      for (const child of node.children ?? []) {
        q.push({ node: child, depth: depth + 1 });
      }
    }
    return out;
  }, []);

  // Additional diagnostics
  const maxDepthFromResponse = useCallback((resp?: SunburstResponse) => {
    if (!resp) return 0;
    let max = 0;
    for (const n of resp.nodes) {
      // path includes root at index 0
      max = Math.max(max, n.path.length - 1);
    }
    return max;
  }, []);

  const maxDepthFromHierarchy = useCallback((root?: SunburstChartNode | null) => {
    if (!root) return 0;
    let max = 0;
    const q: Array<{ node: SunburstChartNode; depth: number }> = [{ node: root, depth: 0 }];
    while (q.length) {
      const { node, depth } = q.shift()!;
      max = Math.max(max, depth);
      for (const child of node.children ?? []) {
        q.push({ node: child, depth: depth + 1 });
      }
    }
    return max;
  }, []);

  const totalsFromHierarchy = useCallback((root?: SunburstChartNode | null) => {
    if (!root) return { totalNodes: 0, leaves: 0 };
    let total = 0;
    let leaves = 0;
    const stack: SunburstChartNode[] = [root];
    while (stack.length) {
      const n = stack.pop()!;
      total += 1;
      if (!n.children || n.children.length === 0) {
        leaves += 1;
      } else {
        for (const c of n.children) stack.push(c);
      }
    }
    return { totalNodes: total, leaves };
  }, []);

  const hierarchy = useMemo(() => {
    if (!data) {
      logDebug("hierarchy:skip", { reason: "no-data" });
      return null;
    }

    try {
      const tree = buildHierarchy(data);
      logDebug("hierarchy:built", {
        pi: data.pi,
        nodeCount: data.nodes.length,
        hasTree: Boolean(tree),
        firstRing: tree?.children?.length ?? 0,
        rootValue: tree?.value ?? 0
      });
      logDebug("hierarchy:levels", {
        fromResponse: countLevelsFromResponse(data),
        fromHierarchy: countLevelsFromHierarchy(tree),
        maxDepth: {
          response: maxDepthFromResponse(data),
          hierarchy: maxDepthFromHierarchy(tree)
        },
        totals: totalsFromHierarchy(tree)
      });
      return tree;
    } catch (error) {
      logDebug("hierarchy:error", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }, [data, logDebug]);
  const dataRef = useRef<SunburstResponse | undefined>(data);
  const hierarchyRef = useRef<SunburstChartNode | null>(hierarchy);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string[]>([]);

  useEffect(() => {
    dataRef.current = data ?? undefined;
    hierarchyRef.current = hierarchy;

    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) {
      logDebug("effect:data", {
        container: Boolean(container),
        chart: Boolean(chart)
      });
      return;
    }

    const c = chart as unknown as SunburstApi;

    if (sizeRef.current === null) {
      sizeRef.current = updateChartSize(c, container, logDebug);
    }

    renderChart(c, container, hierarchy, logDebug);
    focusActiveNode(c, hierarchy, activeNodeIdRef.current, logDebug);
    centerViz(container);
    {
      const hasViz = Boolean(container.querySelector(".sunburst-viz"));
      const hasSvg = Boolean(container.querySelector("svg"));
      logDebug("chart:dom", {
        phase: "data-effect",
        children: container.childElementCount,
        hasViz,
        hasSvg
      });
    }
  }, [data, hierarchy, logDebug]);

  useEffect(() => {
    if (!hierarchy) {
      setActiveNodeId(null);
      setActivePath([]);
      activeNodeIdRef.current = null;
      activePathRef.current = [];
      return;
    }

    const rootPath = hierarchy.data?.path ?? [hierarchy.name];
    logDebug("hierarchy:reset-active", { nodeId: hierarchy.id, pathLength: rootPath.length });
    setActiveNodeId(hierarchy.id);
    setActivePath(rootPath);
    activeNodeIdRef.current = hierarchy.id;
    activePathRef.current = rootPath;
  }, [hierarchy, logDebug]);

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      logDebug("chart:mount:skip", { reason: "no-container" });
      return;
    }

    const resetToRoot = () => {
      const currentHierarchy = hierarchyRef.current;
      if (!currentHierarchy) {
        setActiveNodeId(null);
        setActivePath([]);
        activeNodeIdRef.current = null;
        activePathRef.current = [];
        onSelectRef.current(null);
        return;
      }

      const rootPath = currentHierarchy.data?.path ?? [currentHierarchy.name];
      setActiveNodeId(currentHierarchy.id);
      setActivePath(rootPath);
      activeNodeIdRef.current = currentHierarchy.id;
      activePathRef.current = rootPath;
      chartRef.current?.focusOnNode(null);
      onSelectRef.current(null);
    };

    if (!chartRef.current) {
      logDebug("chart:init");
      const chart = (Sunburst as any)() as SunburstApi;

      chart
        .label((node: SunburstChartNode) => node.data?.label ?? node.name ?? "")
        .size("value")
        .color((node: SunburstChartNode) => resolveColor(node, dataRef.current))
        .tooltipTitle((node: SunburstChartNode) => node.data?.label ?? node.name ?? "")
        .tooltipContent((node: SunburstChartNode) => buildTooltip(node, dataRef.current))
        .onClick((node: SunburstChartNode | null) => {
          const chartInstance = chartRef.current;
          if (!chartInstance) {
            return;
          }

          if (!node) {
            resetToRoot();
            return;
          }

          chartInstance.focusOnNode(node);

          const nextPath = node.data?.path ?? hierarchyRef.current?.data?.path ?? [];
          const nextNodeId = node.id ?? pathToNodeId(nextPath);
          logDebug("chart:click", {
            issueKey: node.data?.issueKey ?? null,
            nodeId: nextNodeId,
            depth: node.data?.depth ?? null,
            pathLength: nextPath.length
          });
          setActiveNodeId(nextNodeId);
          setActivePath(nextPath);
          activeNodeIdRef.current = nextNodeId;
          activePathRef.current = nextPath;

          const issueKey = node.data?.issueKey ?? null;
          onSelectRef.current(issueKey);
        })
        .minSliceAngle(0)
        .excludeRoot(true)
        .radiusScaleExponent(1)
        .showLabels(true)
        .maxLevels(5);

      chartRef.current = chart;
    }

    const chart = chartRef.current as unknown as SunburstApi;

    logDebug("chart:mount", {
      container: Boolean(container),
      chart: Boolean(chart)
    });

    const handleResize = () => {
      logDebug("chart:resize:trigger");

      // Skip if container is no longer in the document (prevents NaN sizing)
      if (!container.isConnected) {
        logDebug("chart:resize:skip", { reason: "container-disconnected" });
        return;
      }

      const size = updateChartSize(chart, container, logDebug);
      sizeRef.current = size;

      renderChart(chart, container, hierarchyRef.current ?? null, logDebug);
      focusActiveNode(chart, hierarchyRef.current ?? null, activeNodeIdRef.current, logDebug);
      centerViz(container);
    };

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", handleResize);
    }

    const initialSize = updateChartSize(chart, container, logDebug);
    sizeRef.current = initialSize;
    renderChart(chart, container, hierarchyRef.current ?? null, logDebug);
    focusActiveNode(chart, hierarchyRef.current ?? null, activeNodeIdRef.current, logDebug);
    centerViz(container);
    {
      const hasViz = Boolean(container.querySelector(".sunburst-viz"));
      const hasSvg = Boolean(container.querySelector("svg"));
      logDebug("chart:dom", {
        phase: "mount",
        children: container.childElementCount,
        hasViz,
        hasSvg
      });
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [hierarchy]);

  useEffect(() => {
    const chart = chartRef.current;
    const currentHierarchy = hierarchyRef.current;
    if (!chart || !containerRef.current) {
      logDebug("focus:skip", {
        chart: Boolean(chart),
        container: Boolean(containerRef.current)
      });
      return;
    }

    focusActiveNode(chart, currentHierarchy, activeNodeId, logDebug);
  }, [activeNodeId, hierarchy, logDebug]);

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(activePath, dataRef.current),
    [activePath]
  );

  const handleBreadcrumbClick = useCallback(
    (path: string[], issueKey: string | null) => {
      if (!hierarchyRef.current) {
        return;
      }

      const nodeId = pathToNodeId(path);

      logDebug("breadcrumbs:select", {
        pathLength: path.length,
        nodeId,
        issueKey
      });

      setActiveNodeId(nodeId);
      setActivePath(path);
      activeNodeIdRef.current = nodeId;
      activePathRef.current = path;

      if (issueKey) {
        onSelect(issueKey);
      } else {
        onSelect(null);
      }
    },
    [onSelect]
  );

  if (isLoading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-border-light bg-panel-light text-muted-light transition-colors dark:border-border-dark dark:bg-panel-dark dark:text-muted-dark">
        <p className="text-sm">Loading sunburst…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition-colors dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
        <p className="max-w-md text-center text-sm">{error}</p>
      </div>
    );
  }

  if (!hierarchy || (hierarchy.children?.length ?? 0) === 0) {
    logDebug("render:skip", {
      reason: "no-hierarchy-or-children",
      hasHierarchy: Boolean(hierarchy),
      childrenCount: hierarchy?.children?.length ?? 0,
      hierarchyValue: hierarchy?.value ?? 0
    });
    return (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-border-light bg-panel-light text-muted-light transition-colors dark:border-border-dark dark:bg-panel-dark dark:text-muted-dark">
        <p className="max-w-md text-center text-sm">No data for the selected filters.</p>
      </div>
    );
  }

  const showReset = Boolean(activeNodeId && hierarchy && activeNodeId !== hierarchy.id);

  logDebug("render:chart", {
    hasHierarchy: Boolean(hierarchy),
    hasChart: Boolean(chartRef.current),
    hasContainer: Boolean(containerRef.current),
    showReset,
    activeNodeId,
    hierarchyId: hierarchy?.id,
    levels: {
      response: countLevelsFromResponse(dataRef.current),
      hierarchy: countLevelsFromHierarchy(hierarchy)
    }
  });

  return (
    <div className="flex flex-col gap-3">
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Sunburst navigation"
          className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-light dark:text-muted-dark"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <div key={crumb.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(crumb.path, crumb.issueKey)}
                  disabled={isLast}
                  aria-current={isLast ? "page" : undefined}
                  className={`rounded border px-2 py-1 text-xs transition-colors focus:outline-none focus-visible:ring focus-visible:ring-sky-500 ${
                    isLast
                      ? "cursor-default border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-200"
                      : "border-border-light/60 bg-panel-light text-muted-light hover:bg-border-light/40 dark:border-border-dark/60 dark:bg-panel-dark dark:text-muted-dark dark:hover:bg-border-dark/40"
                  }`}
                >
                  {crumb.label}
                </button>
                {!isLast && <span className="text-muted-light dark:text-muted-dark">/</span>}
              </div>
            );
          })}
        </nav>
      )}
      <div
        ref={containerRef}
        className="relative h-[520px] w-full rounded-md border border-border-light bg-panel-light p-4 transition-colors dark:border-border-dark dark:bg-panel-dark"
        role="application"
        aria-label="Goal sunburst chart"
      >
        {showReset && (
          <button
            type="button"
            onClick={() => {
              logDebug("chart:reset-view");
              handleBreadcrumbClick(hierarchy.data?.path ?? [hierarchy.name], null);
            }}
            className="absolute right-4 top-4 rounded-md border border-border-light bg-panel-light/80 px-3 py-1 text-xs font-medium text-muted-light shadow-sm transition hover:bg-border-light/60 focus:outline-none focus-visible:ring focus-visible:ring-sky-500 dark:border-border-dark dark:bg-panel-dark/80 dark:text-muted-dark"
          >
            Reset view
          </button>
        )}
      </div>
    </div>
  );
}

function renderChart(
  chart: SunburstApi,
  container: HTMLDivElement,
  hierarchy: SunburstChartNode | null,
  logDebug: (...values: unknown[]) => void
) {
  if (!hierarchy) {
    logDebug("renderChart:empty");
    chart.data({ name: "empty", value: 1, children: [] });
  } else {
    logDebug("renderChart:data", {
      rootValue: hierarchy.value,
      childCount: hierarchy.children?.length ?? 0
    });
    chart.data(hierarchy);
  }

  chart(container);
  {
    const viz = container.querySelector(".sunburst-viz");
    const svg = container.querySelector("svg");
    logDebug("chart:dom", {
      phase: "post-render",
      children: container.childElementCount,
      hasViz: Boolean(viz),
      hasSvg: Boolean(svg)
    });
  }
}

function focusActiveNode(
  chart: SunburstApi | null,
  hierarchy: SunburstChartNode | null,
  nodeId: string | null,
  logDebug: (...values: unknown[]) => void
) {
  if (!chart) {
    return;
  }

  if (!hierarchy || !nodeId || nodeId === hierarchy.id) {
    logDebug("focus:root", { nodeId });
    chart.focusOnNode(null);
    return;
  }

  const target = findNodeById(hierarchy, nodeId);
  if (target) {
    logDebug("focus:node", {
      nodeId,
      issueKey: target.data?.issueKey ?? null,
      depth: target.data?.depth ?? null
    });
    chart.focusOnNode(target);
  } else {
    logDebug("focus:missing", { nodeId });
    chart.focusOnNode(null);
  }
}

function updateChartSize(
  chart: SunburstApi,
  container: HTMLDivElement,
  logDebug: (...values: unknown[]) => void
) {
  const rect = container.getBoundingClientRect();
  const styles = window.getComputedStyle(container);

  // Robust parsing of paddings to avoid NaN
  const toNum = (v: string | null | undefined) => {
    const n = parseFloat(v || "0");
    return Number.isFinite(n) ? n : 0;
  };

  const padL = toNum(styles.paddingLeft);
  const padR = toNum(styles.paddingRight);
  const padT = toNum(styles.paddingTop);
  const padB = toNum(styles.paddingBottom);

  const horizontalPadding = padL + padR;
  const verticalPadding = padT + padB;

  const rawW = Number.isFinite(rect.width) ? rect.width : 0;
  const rawH = Number.isFinite(rect.height) ? rect.height : 0;

  let width = rawW - horizontalPadding;
  let height = rawH - verticalPadding;

  // Clamp to non-negative and handle non-finite values
  width = Number.isFinite(width) ? Math.max(0, width) : 0;
  height = Number.isFinite(height) ? Math.max(0, height) : 0;

  let size = Math.min(width, height);
  if (!Number.isFinite(size) || size <= 0) {
    // Fallback to a sane default to avoid NaN viewBox updates
    size = MIN_CHART_SIZE;
  }

  logDebug("chart:size", {
    width,
    height,
    size,
    rect,
    styles: {
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      paddingTop: styles.paddingTop,
      paddingBottom: styles.paddingBottom
    }
  });

  chart.width(size).height(size);
  return size;
}

function centerViz(container: HTMLDivElement) {
  const viz = container.querySelector<HTMLElement>(".sunburst-viz");
  if (!viz) {
    return;
  }

  viz.style.position = "absolute";
  viz.style.top = "50%";
  viz.style.left = "50%";
  viz.style.transform = "translate(-50%, -50%)";
  viz.style.pointerEvents = "auto";

  const svg = viz.querySelector<SVGElement>("svg");
  if (svg) {
    svg.style.display = "block";
  }
}

function findNodeById(
  node: SunburstChartNode | null,
  nodeId: string
): SunburstChartNode | null {
  if (!node) {
    return null;
  }

  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const match = findNodeById(child, nodeId);
    if (match) {
      return match;
    }
  }

  return null;
}

function pathToNodeId(path: string[]): string | null {
  if (!path || path.length === 0) {
    return null;
  }

  return path.length === 1 ? path[0] : path.join("|");
}

function buildBreadcrumbs(
  activePath: string[],
  response?: SunburstResponse
): Array<{ id: string; label: string; issueKey: string | null; path: string[] }> {
  if (!response || activePath.length === 0) {
    return [];
  }

  return activePath.map((key, index) => {
    const path = activePath.slice(0, index + 1);
    const id = pathToNodeId(path) ?? key;
    const isRoot = index === 0;
    const meta = isRoot ? undefined : response.meta.issues[key];
    const label = isRoot
      ? response.pi
      : meta
      ? `${meta.key} · ${meta.type}`
      : key;

    const issueKey = isRoot ? null : meta?.key ?? key;

    return {
      id,
      label,
      issueKey,
      path
    };
  });
}

function resolveColor(node: SunburstChartNode, response?: SunburstResponse) {
  if (node.color) {
    return node.color;
  }

  const issueKey = node.data?.issueKey;
  if (!issueKey || !response) {
    return "#1E293B";
  }

  const meta = response.meta.issues[issueKey];
  return getStatusColor(meta?.statusCategory, meta?.status);
}

function buildTooltip(node: SunburstChartNode, response?: SunburstResponse) {
  const issueKey = node.data?.issueKey;
  if (!issueKey || !response) {
    return "<div class=\"text-xs\">No details</div>";
  }

  const meta = response.meta.issues[issueKey];
  if (!meta) {
    return "";
  }

  const color = getStatusColor(meta.statusCategory, meta.status);
  const textColor = getStatusLabelColor(meta.statusCategory, meta.status);

  const fixVersions = meta.fixVersions.length > 0 ? meta.fixVersions.join(", ") : "—";
  const assignee = meta.assignee ?? "Unassigned";

  return `
    <div style="max-width: 220px;">
      <div style="font-weight:600;color:${color};margin-bottom:4px;">${meta.key} · ${meta.type}</div>
      <div style="color:${textColor};font-weight:500;margin-bottom:4px;">${meta.summary}</div>
      <div style="color:#cbd5f5;font-size:11px;margin-bottom:2px;">Status: ${meta.status}</div>
      <div style="color:#cbd5f5;font-size:11px;margin-bottom:2px;">Project: ${meta.project}</div>
      <div style="color:#cbd5f5;font-size:11px;margin-bottom:2px;">Fix Versions: ${fixVersions}</div>
      <div style="color:#cbd5f5;font-size:11px;">Assignee: ${assignee}</div>
    </div>
  `;
}
