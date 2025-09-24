# Product Requirements Document — Jira PI Sunburst

## 0. Summary

A React + Vite + Tailwind web app with a small Node proxy that reads `JIRA_BASE_URL` and `JIRA_TOKEN` from env and talks to Jira Data Centre. The app:

- Lets a user pick a **PI** (fixVersion) from **TPO** versions (PI28+; both released/unreleased; sorted desc; default latest *unreleased*).
- Applies filter: **Program Increment** (required).
- Fetches **Goals** in TPO with that PI, then traverses links to build a **sunburst**:
  - Ring 1: **Goal** (TPO)
  - Ring 2: **Impact** (TPO)
  - Ring 3: **Feature, Story, Enabler, Spike** (various projects; often SP) — **flat**, only those directly linked from Impacts
  - Ring 4: **Objective** (SPO) via `relates to`
- **Wedge size** = **count of issues** (each node = 1). **Duplication allowed** when an issue has multiple parents.
- **Colour by Status Category**.
- **Interaction**: click animates into the selected wedge (zoom) while opening the **in-app details sidebar** and surfacing an **“Open in Jira”** button; hover shows tooltip.
- Save filters locally and encode in **URL query params** for shareability.

## 1. Scope & rules

### 1.1 Jira environment & auth

- Jira DC base URL: **env** `JIRA_BASE_URL` (e.g. `https://jira.skatelescope.org/`)
- Auth: **PAT** via `Authorization: Bearer ${JIRA_TOKEN}` read from **env** `JIRA_TOKEN`.
- All Jira requests go through the **Node proxy**; browser never sees the token.

### 1.2 Ring mapping (exact types)

- **Ring 1 (Goals):** Issue Type `Goal` (project TPO).
- **Ring 2 (Impacts):** Issue Type `Impact` (project TPO).
- **Ring 3 (Features/Stories):** Issue Types `Feature`, `Story`, `Enabler`, `Spike` (various projects, often SP). **No child expansion**.
- **Ring 4 (Objectives):** Issue Type `Objective` (project SPO).

### 1.3 Link types (exact names)

- **Goal ↔ Impact:** outward `is achieved through`, inward `helps achieve`.
- **Impact ↔ Feature/Story/Enabler/Spike:** outward `realised by`, inward `realises`.
- **Feature/Story/Enabler/Spike ↔ Objective:** outward `relates to`, inward `relates to`.

### 1.4 Entry set, traversal & inclusion

- Entry set: **Goals** in **TPO** where `fixVersion = <selected PI>`.
- Traverse **outward** along link types in order:
  1. Goal —`is achieved through`→ Impact
  2. Impact —`realised by`→ Feature/Story/Enabler/Spike
  3. (Ring-3 item) —`relates to`→ Objective
- **Include downstream items regardless of their own fixVersion.**
- **Projects included:** start with **TPO** only; include additional projects **only as reached via links** from TPO Goals/Impacts (common cases: SP for Ring-3, SPO for Ring-4).
- **Many-to-many:** Duplicate nodes under each valid parent path in the sunburst.

### 1.5 Filters

- **PI (fixVersion) selector** from **TPO**:
  - Include versions **PI28, PI29, PI30 …** (names >= “PI28” lexicographically), both released/unreleased.
  - Sorted **descending by version name**.
  - Exclude PIs that currently have zero Goal issues; the dropdown only shows PIs with data.
  - **Default:** latest **unreleased** by name.
- **Persistence & sharing:**
  - Persist the selected PI in **localStorage**.
  - Reflect the PI in the **URL** query params (e.g., `?pi=PI29`) so the view is shareable.

## 2. Non-functional

- Target data scale: up to **\~10 Goals**, each \~**10 Impacts**, each \~**10 Ring-3**; **1–2 Objectives** per Ring-3 → worst-case **\~1,500 nodes** (with duplication).
- **Hard cap:** stop traversal above **1,500 nodes** and surface a warning banner (“Too many nodes; showing first 1,500”).
- **Timeouts:** server-side per Jira call **10s**; overall traversal **30s** budget; surface error states.
- **Caching:** proxy may cache PI version list for **5 minutes** (memory).
- **Security:** token only on server; **do not log** auth headers; CORS allow app origin only. Optional env `JIRA_REJECT_UNAUTHORIZED=true` (allow override only if explicitly set `false` for self-signed TLS).
- **Accessibility:** chart must be keyboard-focusable; sidebar content readable; provide status legend.

## 3. Architecture

### 3.1 Repository layout

```
/src             # React app (TypeScript, Vite, Tailwind, sunburst-chart)
/server          # Node/Express proxy (TypeScript)
/public          # static assets
.env.example     # JIRA_BASE_URL, JIRA_TOKEN, PORT, JIRA_REJECT_UNAUTHORIZED
Dockerfile
docker-compose.yml (optional)
```

### 3.2 Runtime & tooling

- **TypeScript** throughout.
- **React 18**, **Vite**, **Tailwind**.
- **sunburst-chart** D3 wrapper (`sunburst-chart`), with optional `react-sunburst-chart` binding for declarative React integration.
- **TanStack Query** for data fetching/caching.
- **Vitest** for unit tests.
- **Node LTS 20**.
- **Docker** image delivering static client and Node proxy (single container).

## 4. Server (proxy) specification

### 4.1 Env

- `JIRA_BASE_URL` (required) — e.g., `https://jira.skatelescope.org`
- `JIRA_TOKEN` (required) — PAT
- `PORT` (default 8080)
- `JIRA_REJECT_UNAUTHORIZED` (default `true`)

### 4.2 API surface (all JSON)

- `GET /api/versions?project=TPO`
  - **Fetch:** Jira `GET /rest/api/2/project/{projectKey}/versions`
  - **Filter:** names like `^PI\d+$` and `>= PI28` by lexicographic compare.
  - **Sort:** desc by name.
  - **DefaultUnreleased:** compute latest `released=false`.
  - **Response:**

    ```json
    {
      "versions": [{"id":"12345","name":"PI30","released":false}, ...],
      "default": {"id":"...", "name":"PI30", "released":false}
    }
  
  
- `GET /api/sunburst?project=TPO&pi=PI29`
  - **Steps:**
    1. **Goals:** JQL\
      `project = TPO AND issuetype = Goal AND fixVersion = "PI29" ORDER BY key`\
       Fields: `key,summary,issuetype,status,statuscategory,fixVersions,project,assignee,issuelinks,customfield_12001`
    2. Collect **Impacts** via links with outward `is achieved through` or inward `helps achieve` (from the Goal).
    3. Fetch Impact details in bulk (JQL `key in (...)`). Fields as above.
    4. From each Impact, collect Ring-3 via outward `realised by` or inward `realises` (types limited to `Feature, Story, Enabler, Spike`).
    5. Fetch Ring-3 details in bulk.
    6. From each Ring-3, collect **Objectives** via `relates to`. Limit to Issue Type `Objective` (project SPO).
    7. Fetch Objective details in bulk.
    8. Build **paths**: `[<PI-root>, Goal, Impact, Ring3, Objective?]`, **duplicating** nodes for many-to-many.
    9. Enforce **node cap**; set `truncated=true` if exceeded.
  - **Response:**
  
    ```json
    {
      "pi":"PI29",
      "truncated": false,
      "nodes":[
        {"path":["PI29","G-1","I-2","E-9","OBJ-3"],"id":"OBJ-3","label":"OBJ-3 · Objective","statusCategory":"In Progress"},
        {"path":["PI29","G-1","I-2","E-9"],"id":"E-9","label":"E-9 · Feature","statusCategory":"To Do"},
        ...
      ],
      "meta":{
        "issues": {
          "G-1":{"key":"G-1","type":"Goal","summary":"...", "status":"In Progress","statusCategory":"In Progress","project":"TPO","fixVersions":["PI29"],"telescope":["Mid"]},
          ...
        }
      }
    }
    ```

### 4.3 Jira API details & pagination

- Use `/rest/api/2/search` with `maxResults=100` and paginate for bulk fetches (`startAt` loop).
- Always request **minimal fields**:\
  `fields=key,summary,issuetype,status,project,fixVersions,assignee,issuelinks,customfield_12001,statuscategory`
  - Note: **statuscategory** is accessible via `status.statusCategory.name` / `.key`; return a flattened `statusCategory` string `{To Do|In Progress|Done}`.
- **Link parsing:** Each `issuelink` has:
  - `type.name`, `type.outward`, `type.inward`
  - `outwardIssue` / `inwardIssue` with `key` (may not include full fields; hence follow-up bulk fetch).
- De-duplicate keys per ring before bulk fetch; continue until all rings gathered or **cap** hit.

### 4.4 Errors

- Upstream 401/403: return 502 with `{error:"Jira auth failed"}`.
- Timeout: 504 with `{error:"Jira timeout"}`.
- Over-cap: 200 with `truncated:true` and a banner message field.

## 5. Client specification

### 5.1 UI

- **Header bar:**
  - **PI dropdown** (from `/api/versions?project=TPO`)
  - **Copy link** button (writes URL with current query params)
- **Main:** **sunburst-chart** visual centred on the selected PI (virtual root) with built-in zoom/interaction controls.
- **Right sidebar (drawer):** opens on wedge click; shows:
  - Key, Summary, Type, Status, Project, FixVersion(s), Telescope(s) (if present), direct **Open in Jira** button.
  - **Links section:** list of parents/children by our ring relationships (for context only).
- **Footer banner:** shows warnings (e.g., truncated data, Jira errors).

### 5.2 State & data flow

- Use **URL query params** as source of truth (sync to local UI and **persist** in localStorage).
- Fetch **sunburst data** via TanStack Query keyed by `{pi}`.
- When PI changes, refetch the sunburst data and reset any selected node.

### 5.3 Sunburst construction (sunburst-chart)

- Convert server `nodes[]` into a nested `SunburstTreeNode` structure consumed by **sunburst-chart**:
  - Root: `{ name: <PI>, value: totalNodes, children: [...] }` representing the virtual PI container.
  - Child nodes mirror Goal → Impact → Delivery → Objective paths; duplicates are materialised as distinct entries under each parent.
  - Each node stores rich metadata on the `data` field (issue key, depth, type, statusCategory) so event handlers and tooltips can access it directly.
- Pass the hierarchy to the chart via `.data(tree)` and size wedges with `.size("value")`; leaf nodes contribute `value = 1`, intermediate nodes aggregate the sum automatically.
- Map deterministic colours by status using the `.color(node => ...)` accessor, precomputing a `color` property when a node needs to override the default palette.
- Use `.label` and `.tooltip{Title,Content}` to surface Jira identifiers, summaries, and status details; support HTML tooltips for richer formatting.
- Keep node identifiers stable (e.g. embed `id` in `data.issueKey`) so transitions between PI selections animate smoothly.

### 5.4 Interaction behaviour

- Clicking any wedge triggers `focusOnNode` to zoom into that ring, centres the selection, and opens the Details sidebar with metadata plus an “Open in Jira” link.
- Provide a persistent breadcrumb/back control (including clicking the chart centre) to zoom out to ancestor nodes or reset to the PI root.
- Maintain path highlighting for the active node and dim non-ancestors so users can follow hierarchy depth while zoomed in.
- Hovering surfaces a tooltip with key summary fields (key, type, status, project, fix versions, assignee).
- Changing the PI resets zoom and selection state and triggers a fresh traversal from Jira.

### 5.5 React integration strategy

- Continue with the imperative `sunburst-chart` instance for fine-grained control of sizing and tooltips, but encapsulate it in a dedicated component that exposes focus/zoom helpers to the rest of the app.
- Evaluate `react-sunburst-chart` if we want a declarative wrapper: it forwards props such as `data`, `value`, `label`, `tooltipContent`, and `onClick`, and exposes the underlying chart instance for direct calls to `focusOnNode` or other API methods when needed.
- Whichever approach we adopt, co-locate chart configuration so interactive affordances (zoom, breadcrumbs, highlighting) remain consistent across both implementations.

## 6. Data model (TypeScript)

```ts
// Server → Client DTOs
type StatusCategory = "To Do" | "In Progress" | "Done";

interface IssueMeta {
  key: string;
  type: "Goal" | "Impact" | "Feature" | "Story" | "Enabler" | "Spike" | "Objective";
  summary: string;
  status: string;
  statusCategory: StatusCategory;
  project: string;
  fixVersions: string[];             // names only
  telescope?: string[];              // from customfield_12001
  assignee?: string | null;          // display name if present
}

interface SunburstPathNode {
  path: string[]; // e.g. ["PI29","G-1","I-2","E-9","OBJ-3"]
  id: string;     // issue key for last element in path
  label: string;  // "KEY · Type"
  statusCategory: StatusCategory;
}

interface SunburstResponse {
  pi: string;
  truncated: boolean;
  nodes: SunburstPathNode[];
  meta: { issues: Record<string, IssueMeta> };
}

// Client-side hierarchy fed to sunburst-chart
interface SunburstTreeNode {
  name: string;
  value: number;
  color?: string;
  data?: {
    issueKey?: string;
    type?: IssueMeta["type"];
    statusCategory?: StatusCategory;
    depth: number;
  };
  children?: SunburstTreeNode[];
}
```

## 7. Algorithms (server)

**BuildSunburst(pi):**

1. `goals = Search(JQL: project=TPO AND issuetype=Goal AND fixVersion="<pi>")`
2. `impactsKeys = linksFrom(goals, type.outward=="is achieved through" || type.inward=="helps achieve")`
3. `impacts = BulkFetch(impactsKeys)`
4. `ring3Keys = linksFrom(impacts, outward=="realised by" || inward=="realises", allowedTypes=Feature|Story|Enabler|Spike)`
5. `ring3 = BulkFetch(ring3Keys)`
6. `objectivesKeys = linksFrom(ring3, outward/inward=="relates to", allowedTypes=Objective)`
7. `objectives = BulkFetch(objectivesKeys)`
8. For each path (Goal → Impact → Ring3 [→ Objective?]), **emit a path** (with duplication where many parents exist).
9. Return DTO with `truncated` if cap hit.

**Notes:**

- `linksFrom` must inspect each `issuelink` and match by `type.outward`/`type.inward` **strings exactly** as specified.
- For any linked key not in hand, add to a batch list and bulk fetch via `/search key in (...)`.

## 8. Acceptance criteria

1. **PI dropdown** shows PI28+ in desc order; default = latest unreleased with data.
2. Changing PI triggers a fresh traversal and clears any previously selected node.
3. Sunburst inner ring = **Goals**; second ring **Impacts**; third **Feature/Story/Enabler/Spike** flat; fourth **Objective**; centre label = selected **PI**.
4. **Colour** encodes **status category** consistently across rings.
5. Clicking a wedge zooms the chart to that node via `focusOnNode`, opens the **sidebar** with correct metadata, and surfaces an **Open in Jira** link (target `_blank`).
6. **Duplication:** if an Impact is linked from two Goals, it appears under both; counts increase accordingly.
7. **URL sharing:** copying the link reproduces the same PI selection.
8. **Security:** no network request from the browser contains Jira credentials; CORS locked to app origin.
9. **Performance:** datasets up to cap render within 2s on a typical laptop; server responses honour timeouts; clear errors on Jira failure.
10. Providing a breadcrumb/centre interaction allows users to zoom back out to the PI root without reloading data.

## 9. Deploy & run

### 9.1 Local dev

- `npm run dev` → concurrently start Vite client and Node proxy (port e.g. 5173 & 8080).
- `.env` with `JIRA_BASE_URL`, `JIRA_TOKEN`.

### 9.2 Production container

- **Single Docker image**:
  - Stage 1: build React app (`vite build`).
  - Stage 2: Node server serves `/dist` static files and exposes `/api/*`.
- Config via env at runtime (`JIRA_BASE_URL`, `JIRA_TOKEN`, `PORT`).
- Healthcheck endpoint `GET /health`.

## 10. Risks & mitigations

- **Jira link payload sparsity:** if `issuelinks` omit fields, always follow with **bulk fetch** by keys.
- **Version name sorting:** requirement is **name desc**, not numeric; if PI100 exists it will sort above PI99 (desired).
- **Large graphs:** enforce **cap**, show banner, consider an optional server param `limit`.
- **CORS / TLS quirks on DC:** provide `JIRA_REJECT_UNAUTHORIZED` escape hatch (default `true`).
