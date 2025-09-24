# Jira Goal Sunburst

A Vite + React dashboard backed by a Node/Express proxy that aggregates Jira DC data into an interactive sunburst visualisation. The app lets TPO stakeholders explore Goals, related Impacts, downstream delivery work, and SPO Objectives for a selected PI.

## Features

- Secure proxy that fans out Jira requests and never exposes PATs to the browser
- PI and Telescope filters persisted to URL + localStorage for shareable state
- Nivo sunburst with duplication handling, keyboard focus, tooltips, and truncation warnings
- In-app sidebar with rich issue metadata and deep links back to Jira
- Multi-stage Docker build for prod deployment

## Prerequisites

- Node.js 18+
- npm 9+
- Jira PAT with permission to read the required projects (TPO, SPO, SP, …)

## Environment

Copy `.env.example` to `.env` and populate:

```ini
JIRA_BASE_URL=https://jira.example.com
JIRA_TOKEN=your_token_here
JIRA_REJECT_UNAUTHORIZED=true
PORT=8080
APP_ORIGIN=http://localhost:5173
```

`APP_ORIGIN` may contain a comma-separated list when hosting the client elsewhere.

## Install dependencies

```bash
npm install
```

If your environment blocks outbound installs, fetch the dependencies locally and copy `node_modules` into the project before running the commands below.

## Local development

```bash
npm run dev
```

- Vite dev server: http://localhost:5173
- Node proxy: http://localhost:8080

Both servers restart on changes. The proxy automatically forwards `JIRA_BASE_URL` / `JIRA_TOKEN` into outbound calls and caches the PI version list for 5 minutes.

## Build & preview

```bash
npm run build
npm run preview
```

The build step emits static assets to `dist/client` and the compiled proxy to `dist/server`. `npm run preview` boots the compiled proxy serving the static bundle.

## Testing the build

| Step | Purpose |
| ---- | ------- |
| `npm run build` | Ensures TypeScript checks pass and the client bundles without errors |
| `npm run preview` | Validates the production server can boot with compiled assets |
| Manual smoke test | Visit the preview URL, select a PI, toggle filters, confirm the sidebar and Jira links |

Automated tests are not yet included; add Vitest/Jest and API contract tests as the project evolves.

## Docker usage

Build & run locally:

```bash
docker build -t jira-goal-sunburst .
docker run --rm -p 8080:8080 \
  -e JIRA_BASE_URL=https://jira.example.com \
  -e JIRA_TOKEN=your_token_here \
  -e APP_ORIGIN=http://localhost:8080 \
  -e PORT=8080 \
  jira-goal-sunburst
```

Alternatively, use `docker-compose up --build` to apply the defaults in `docker-compose.yml`.

## Project layout

```sh
/src             React application
/server          Node proxy (TypeScript)
/shared          Client/server shared DTO definitions
/public          Static assets
```

## Notes & next steps

- The server enforces a 1,500 node cap; a banner alerts users when truncation occurs.
- Authentication failures return 502 with a clear error payload.
- Extend with integration tests that stub Jira, plus unit coverage for `buildSunburst` and the filter hook.
