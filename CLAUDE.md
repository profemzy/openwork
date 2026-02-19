# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is OpenWork

OpenWork is an open-source desktop/web application that serves as the UX layer for OpenCode, an agentic coding platform. It's an alternative to Claude Cowork/Codex. The app lets users run agents, skills, and MCP servers with a local-first, composable architecture.

## Monorepo Structure

pnpm workspace (`pnpm@10.27.0`) with these packages:

| Package | Name | Purpose |
|---------|------|---------|
| `packages/app` | `@different-ai/openwork-ui` | SolidJS + TailwindCSS frontend (Vite) |
| `packages/desktop` | `@different-ai/openwork` | Tauri 2.x native shell (Rust) |
| `packages/server` | `openwork-server` | Bun HTTP API for config, approvals, proxy |
| `packages/orchestrator` | `openwork-orchestrator` | CLI that spawns the full stack |
| `packages/opencode-router` | `opencode-router` | Slack/Telegram/WhatsApp bridge |
| `packages/landing` | landing site | Next.js marketing website |

## Common Commands

```bash
# Install
pnpm install

# Development
pnpm dev                  # Desktop app (Tauri + Vite dev server)
pnpm dev:ui               # Web UI only (Vite on port 5173)

# Build
pnpm build                # Desktop app (Tauri build)
pnpm build:ui             # Web UI only (Vite build)

# Type checking
pnpm typecheck            # TypeScript strict check (app package)

# Testing
pnpm test:e2e             # Full E2E suite (spawns real OpenCode servers)
pnpm test:health          # Server health checks
pnpm test:sessions        # Session management
pnpm test:permissions     # Permission flows
pnpm test:refactor        # Quick dev check: typecheck + health + sessions

# Server package
pnpm --filter openwork-server test          # Bun unit tests
pnpm --filter openwork-server build:bin     # Compile standalone binary
pnpm --filter openwork-server dev           # Run server in dev mode

# Orchestrator
pnpm --filter openwork-orchestrator dev     # Run orchestrator in dev mode

# Version bumping (syncs app, desktop, orchestrator, tauri.conf.json, Cargo.toml)
pnpm bump:patch
pnpm bump:minor
pnpm bump:set -- 0.12.0
```

## Architecture

### Two Runtime Modes

**Host Mode (Desktop/Server):** OpenWork runs locally, starts OpenCode on `127.0.0.1:4096`, connects the UI via SDK. The default host runtime is the orchestrator (`openwork`), which spawns `opencode`, `openwork-server`, and optionally `opencode-router` as sidecars. Fallback: direct `opencode serve` spawn.

**Client Mode (Desktop/Mobile):** Connects to an already-running OpenCode server via URL + token. Same UI, no local engine required.

### Event-Driven Data Flow

1. OpenCode emits SSE events (tool calls, messages, permissions, session changes)
2. SolidJS context providers in `packages/app/src/app/context/` subscribe and dispatch to Solid stores
3. UI reactively updates from stores (fine-grained signals, not re-renders)
4. Permission prompts trigger modals that resolve via `client.permission.reply()`

### Key Context Providers (`packages/app/src/app/context/`)

- `global-sdk.tsx` — OpenCode SDK singleton (auth, health, event subscribe)
- `server.tsx` — Server connection management, host mode detection
- `session.ts` — Session store (messages, todos, permissions)
- `platform.tsx` — Tauri vs Web abstraction (`usePlatform()`)
- `sync.tsx` / `global-sync.tsx` — Real-time event sync from OpenCode
- `extensions.ts` — Skills/plugins/MCP state
- `local.tsx` — LocalStorage persistence

### OpenCode SDK Integration

The UI imports `@opencode-ai/sdk/v2/client` (never the server-side `@opencode-ai/sdk/v2`). Client factory is in `packages/app/src/app/lib/opencode.ts`. Core APIs: `client.session.*`, `client.event.subscribe()`, `client.permission.reply()`, `client.config.*`, `client.file.*`.

### Web Parity

Any feature that reads/writes `.opencode/` or `opencode.json` must go through the OpenWork server API, not Tauri-only filesystem calls. This ensures desktop, web, and mobile clients share the same flows.

### OpenCode Extensibility Primitives

OpenWork is a thin layer on top of OpenCode primitives: **skills** (plain-english behavior patterns in `.opencode/skills/`), **plugins** (code-based tools in `opencode.json`), **MCP** (authenticated third-party servers), **commands** (markdown templates in `.opencode/commands/`). Prefer these over custom abstractions.

## SolidJS Patterns

- Use **fine-grained signals** — no shared global `busy()` flags
- Each async action gets its own `pending` signal to avoid deadlocks (e.g., permission modal disabled by unrelated busy state)
- Derive UI state via `createMemo()` instead of duplicating booleans
- Snapshot signal values before `await` — values may change during async execution
- Never mutate arrays/objects in signals in-place; always create new values

## Dev Debugging

- If you change `packages/server/src`, rebuild the binary: `pnpm --filter openwork-server build:bin` — the orchestrator runs the compiled binary, not TS sources
- Desktop dev uses Vite HMR on port 5173 (configurable via `PORT` env)
- Tauri sidecar binaries live in `packages/desktop/src-tauri/sidecars/`

## Design Principles

- **Predictable > Clever**: prefer explicit configuration over heuristics; auto-detection must be explainable, overrideable, and safe
- **CLI-first**: every component is usable via a standalone CLI; the UI wraps but never replaces
- **Local-first**: default to local execution; remote is opt-in via pairing
- **Parity**: UI actions map 1:1 to OpenCode server APIs
- **Least privilege**: only user-authorized folders; explicit approvals for all writes

## Release Process

Releases are triggered by pushing a `v*` tag (e.g., `v0.11.100`), which fires the `Release App` GitHub Action. Version bumping uses `pnpm bump:patch/minor/major` to sync all package versions. Verify with `gh release view vX.Y.Z --repo different-ai/openwork`.

## Key Documentation

- `VISION.md` — Product vision and positioning
- `PRINCIPLES.md` — Decision framework
- `PRODUCT.md` — Requirements and user flows
- `ARCHITECTURE.md` — Runtime modes and SDK integration
- `INFRASTRUCTURE.md` — DevOps and CLI principles
- `AGENTS.md` — Development guidelines and task intake protocol
- `packages/app/pr/*.md` — Feature PRDs
