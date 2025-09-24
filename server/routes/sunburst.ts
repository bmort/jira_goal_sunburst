import { Router } from "express";
import { z } from "zod";

import { AppConfig } from "@server/config";
import { JiraClient } from "@server/lib/jira-client";
import { JiraError } from "@server/lib/errors";
import { buildSunburst } from "@server/lib/sunburst";
import { SunburstFilters } from "@shared/types";

const filtersSchema = z.object({
  pi: z.string().min(1)
});

export function createSunburstRouter(config: AppConfig, jira: JiraClient) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const parsed = filtersSchema.parse(req.query);
      const filters = normalizeFilters(parsed);

      const response = await buildSunburst(
        {
          config,
          jira,
          startTime: Date.now()
        },
        { filters }
      );

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
