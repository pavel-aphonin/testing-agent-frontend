# testing-agent-frontend

React + Ant Design dashboard for Testing Agent. Lets users log in, configure runs, watch live progress, and review exploration results.

## Stack

- **React 18** + **TypeScript**
- **Vite** — dev server + bundler
- **Ant Design 5** — UI components
- **React Router** — routing with role-based guards
- **TanStack Query** — API state management
- **Zustand** — auth state
- **Cytoscape.js** — graph visualization on results page

## Pages

| Path | Roles | Description |
|---|---|---|
| `/login` | public | Email + password login |
| `/runs` | viewer+ | History of exploration runs |
| `/runs/:id/progress` | viewer+ | Live progress stream (WebSocket) |
| `/runs/:id/results` | viewer+ | Graph, screenshots, report |
| `/settings` | tester+ | Agent settings (default mode, default model, timeouts) |
| `/profile` | viewer+ | Change password, view role |
| `/admin/users` | admin | User management |
| `/admin/models` | admin | LLM model upload, config, benchmarks |

## Modals

- **New Run** (triggered from `/runs`) — app upload (.app.zip / .ipa / .apk), device profile, exploration mode (MC / Hybrid / AI), optional scenarios, optional PBT toggle, max steps

## Related repos

- `testing-agent-backend` — FastAPI
- `testing-agent-explorer` — core crawler
- `testing-agent-llm` — llama-swap + llama.cpp
- `testing-agent-infra` — docker-compose stack
