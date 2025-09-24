import { Router } from "express";

import { AppConfig } from "@server/config";
import { JiraClient, escapeJqlValue } from "@server/lib/jira-client";
import { JiraError } from "@server/lib/errors";
import { VersionSummary } from "@shared/types";

interface VersionCacheEntry {
  expiresAt: number;
  data: VersionSummary[];
  defaultPi: string | null;
}

export function createVersionsRouter(config: AppConfig, jira: JiraClient) {
  const router = Router();
  const cache = new Map<string, VersionCacheEntry>();

  router.get("/", async (req, res, next) => {
    const project = String(req.query.project ?? "").trim();

    if (!project) {
      res.status(400).json({ error: "project query parameter is required" });
      return;
    }

    try {
      const cacheKey = project.toUpperCase();
      const now = Date.now();
      const cached = cache.get(cacheKey);

      if (cached && cached.expiresAt > now) {
        res.json({ versions: cached.data, defaultPi: cached.defaultPi });
        return;
      }

      const versions = await jira.getProjectVersions(project);

      const filtered = versions
        .filter((version) => {
          if (!version.name) return false;
          const upper = version.name.toUpperCase();
          if (!upper.startsWith("PI")) {
            return false;
          }

          return upper.localeCompare("PI28", undefined, { sensitivity: "base" }) >= 0;
        })
        .map((version) => ({
          id: version.id,
          name: version.name,
          released: version.released
        }))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));

      const versionsWithData: VersionSummary[] = [];

      const escapedProject = escapeJqlValue(project);
      for (const version of filtered) {
        try {
          const escapedVersion = escapeJqlValue(version.name);
          const jql = `project = ${escapedProject} AND issuetype = Goal AND fixVersion = "${escapedVersion}"`;

          const count = await jira.countIssues(jql);
          if (count > 0) {
            versionsWithData.push(version);
          }
        } catch (error) {
          console.warn(`Failed to verify data for version ${version.name}:`, error);
          versionsWithData.push(version);
        }
      }

      const defaultPi = versionsWithData.find((version) => !version.released)?.name ?? null;

      cache.set(cacheKey, {
        data: versionsWithData,
        defaultPi,
        expiresAt: now + config.limits.versionCacheTtlMs
      });

      res.json({ versions: versionsWithData, defaultPi });
    } catch (error) {
      if (error instanceof JiraError) {
        const status = error.status === 504 ? 504 : 502;
        res.status(status).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  return router;
}
