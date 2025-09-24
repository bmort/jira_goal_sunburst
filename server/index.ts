import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { loadConfig } from "@server/config";
import { JiraClient } from "@server/lib/jira-client";
import { createSunburstRouter } from "@server/routes/sunburst";
import { createVersionsRouter } from "@server/routes/versions";

dotenv.config();

function main() {
  const config = loadConfig();
  const app = express();
  const jira = new JiraClient(config);

  app.disable("x-powered-by");

  app.use(express.json());
  app.use(
    cors({
      origin: config.appOrigins,
      credentials: false
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/versions", createVersionsRouter(config, jira));
  app.use("/api/sunburst", createSunburstRouter(config, jira));

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      // eslint-disable-next-line no-console
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  if (config.nodeEnv === "production") {
    const staticRoot = path.resolve(__dirname, "..", "client");
    app.use(express.static(staticRoot));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticRoot, "index.html"));
    });
  }

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

main();
