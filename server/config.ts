import assert from "assert";

export interface AppConfig {
  port: number;
  appOrigins: string[];
  nodeEnv: "development" | "production" | "test" | string;
  jira: {
    baseUrl: string;
    token: string;
    rejectUnauthorized: boolean;
    requestTimeoutMs: number;
    traversalTimeoutMs: number;
  };
  limits: {
    maxNodes: number;
    versionCacheTtlMs: number;
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return fallback;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 8080);
  const baseUrl = process.env.JIRA_BASE_URL;
  const token = process.env.JIRA_TOKEN;

  assert(baseUrl, "JIRA_BASE_URL is required");
  assert(token, "JIRA_TOKEN is required");

  const rejectUnauthorized = parseBoolean(
    process.env.JIRA_REJECT_UNAUTHORIZED,
    true
  );

  if (!rejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return {
    port,
    appOrigins: (process.env.APP_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    nodeEnv: process.env.NODE_ENV ?? "development",
    jira: {
      baseUrl: baseUrl.replace(/\/$/, ""),
      token,
      rejectUnauthorized,
      requestTimeoutMs: Number(process.env.JIRA_REQUEST_TIMEOUT_MS ?? 10_000),
      traversalTimeoutMs: Number(process.env.JIRA_TRAVERSAL_TIMEOUT_MS ?? 30_000)
    },
    limits: {
      maxNodes: Number(process.env.SUNBURST_MAX_NODES ?? 1_500),
      versionCacheTtlMs: Number(process.env.VERSION_CACHE_TTL_MS ?? 5 * 60 * 1000)
    }
  };
}
