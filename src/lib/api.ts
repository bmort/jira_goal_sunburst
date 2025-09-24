import { SunburstFilters, SunburstResponse, VersionSummary } from "@shared/types";

const DEBUG_PREFIX = "[sunburst:data]";

const logDebug = (...values: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(DEBUG_PREFIX, ...values);
  }
};

interface VersionsResponse {
  versions: VersionSummary[];
  defaultPi: string | null;
}

export async function fetchVersions(projectKey: string): Promise<VersionsResponse> {
  try {
    logDebug("fetchVersions:start", { projectKey });
    const response = await fetch(`/api/versions?project=${encodeURIComponent(projectKey)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch versions (${response.status})`);
    }

    const payload = (await response.json()) as VersionsResponse;
    logDebug("fetchVersions:success", {
      projectKey,
      count: payload.versions.length,
      defaultPi: payload.defaultPi
    });
    return payload;
  } catch (error) {
    if (import.meta.env.DEV) {
      logDebug("fetchVersions:fallback", { error });
      const fallback = await loadFallbackResponse();
      return {
        versions: [
          {
            id: fallback.pi,
            name: fallback.pi,
            released: false
          }
        ],
        defaultPi: fallback.pi
      };
    }

    throw error;
  }
}

export async function fetchSunburst(filters: SunburstFilters): Promise<SunburstResponse> {
  const params = new URLSearchParams();
  params.set("pi", filters.pi);

  try {
    logDebug("fetchSunburst:start", { filters: { ...filters } });
    const response = await fetch(`/api/sunburst?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch sunburst data (${response.status})`);
    }

    const payload = (await response.json()) as SunburstResponse;
    logDebug("fetchSunburst:success", {
      pi: payload.pi,
      nodeCount: payload.nodes.length,
      warnings: payload.warnings?.length ?? 0
    });
    return payload;
  } catch (error) {
    if (import.meta.env.DEV) {
      logDebug("fetchSunburst:fallback", { error, filters: { ...filters } });
      const fallback = await loadFallbackResponse();
      logDebug("fetchSunburst:fallback:loaded", {
        pi: fallback.pi,
        nodeCount: fallback.nodes.length
      });
      return fallback;
    }

    throw error;
  }
}

async function loadFallbackResponse(): Promise<SunburstResponse> {
  console.log("Loading fallback test data");
  const module = await import("../../test_data.json");
  return module.default as SunburstResponse;
}
