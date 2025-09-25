import { Router } from "express";
import { z } from "zod";

import { AppConfig } from "@server/config";
import { JiraClient } from "@server/lib/jira-client";
import { JiraError } from "@server/lib/errors";
import { buildSunburst } from "@server/lib/sunburst";
import { SunburstFilters, SunburstResponse } from "@shared/types";

const filtersSchema = z.object({
  pi: z.string().min(1)
});

interface SunburstCacheEntry {
  expiresAt: number;
  data: SunburstResponse;
}

export function createSunburstRouter(config: AppConfig, jira: JiraClient) {
  const router = Router();
  const cache = new Map<string, SunburstCacheEntry>();

  router.get("/", async (req, res, next) => {
    try {
      const parsed = filtersSchema.parse(req.query);
      const filters = normalizeFilters(parsed);

      const cacheKey = makeCacheKey(filters);
      const now = Date.now();
      const cached = cache.get(cacheKey);

      if (cached && cached.expiresAt > now) {
        res.setHeader("X-Cache", "HIT");
        res.json(cached.data);
        return;
      }

      const response = await buildSunburst(
        {
          config,
          jira,
          startTime: now
        },
        { filters }
      );

      cache.set(cacheKey, {
        data: response,
        expiresAt: now + config.limits.sunburstCacheTtlMs
      });

      res.setHeader("X-Cache", "MISS");
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid query parameters", details: error.errors });
        return;
      }

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

function normalizeFilters(input: z.infer<typeof filtersSchema>): SunburstFilters {
  return {
    pi: input.pi
  };
}

function makeCacheKey(filters: SunburstFilters): string {
  return `PI:${filters.pi.trim().toUpperCase()}`;
}
