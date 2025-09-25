# Repository Guidelines

## Project Structure & Module Organization

- `src/` hosts the Vite + React client (components, hooks, lib helpers) and is bundled to `dist/client`.
- `server/` contains the Express proxy; compiled output lands in `dist/server`.
- `shared/types.ts` exposes DTOs shared by client and server via `@shared/*` path aliases.
- Configuration lives at the root (`vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`); keep environment secrets in `.env` only.

## Build, Test, and Development Commands

- `npm run dev` starts both the Vite client (port 5173) and proxy (port 8080) with live reload.
- `npm run build` runs `vite build` plus `tsc` for the proxy, emitting the production bundle.
- `npm run preview` / `npm start` boots the compiled proxy and serves the built client.
- `npm test` executes Vitest in run mode; add focussed suites with `vitest --run --coverage` when needed.

## Coding Style & Naming Conventions

- TypeScript is strict; prefer `.ts(x)` modules with explicit types for API boundaries.
- Use 2-space indentation, single quotes in JSON, and double quotes in TypeScript per existing files.
- Import via path aliases (`@/*`, `@server/*`, `@shared/*`) instead of deep relative paths.
- Tailwind utility classes live in `src/index.css`; keep component styles declarative and co-located.

## Testing Guidelines

- Place unit tests adjacent to source files (`Component.test.tsx`) or in `server/lib/__tests__` for proxy logic.
- Use Vitest with `@testing-library/react` (add as needed) for client behavior; seed API fixtures from `test_data.json`.
- Target smoke coverage for critical flows (PI selection, sunburst fetch, sidebar interactions) before merging.

## Commit & Pull Request Guidelines

- Follow concise, imperative commit titles (`Add PI fallback handling`, `Fix proxy cache logging`); recent history favors single-line summaries without prefixes.
- Squash feature branches before merging; reference Jira tickets in the body when applicable.
- Pull requests should include: purpose summary, screenshots or GIFs for UI changes, environment/config notes, and test evidence (`npm test`, manual checks).

## Security & Configuration Tips

- Never commit PATs or `.env`; use `.env.example` to document new keys.
- When deploying, set `JIRA_REJECT_UNAUTHORIZED=false` only for trusted corporate TLS interceptors and document the rationale in the PR.
