# OpenWork Entity Architecture

How all entities in the OpenWork/OpenCode system relate and interact.

## Configuration Layer

```
Workspace (project root)
│
├── opencode.json                      ← Central config
│   ├── mcp: { servers }               ← MCP server definitions
│   ├── plugin: [ packages ]           ← Plugin packages
│   ├── tools: { allow/deny }          ← Tool permission rules
│   ├── instructions: [ files ]        ← Context files (incl. soul.md)
│   └── model: { default }             ← Default model selection
│
└── .opencode/                         ← Entity definitions
    ├── agent/*.md                     ← Agent personas
    ├── skills/*/SKILL.md              ← Skill knowledge documents
    ├── commands/*.md                  ← Slash command templates
    ├── soul.md                        ← Persistent memory
    └── soul/heartbeat.jsonl           ← Heartbeat check-in log
```

## Entity Definitions

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐
│ Agents  │  │ Skills  │  │Commands │  │ Plugins │  │ MCP Servers  │
│         │  │         │  │         │  │         │  │              │
│ persona │  │knowledge│  │ slash   │  │ code    │  │ third-party  │
│ model   │  │triggers │  │templates│  │ tools   │  │ tools        │
│ perms   │  │patterns │  │ agent   │  │ npm/dir │  │ remote/local │
│ temp    │  │         │  │ model   │  │         │  │ oauth        │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘
     │            │            │            │               │
     └────────────┴────────────┴────────────┴───────────────┘
                               │
                               ▼
                      OpenCode Engine
```

## Session Execution Flow

```
User types prompt in Session
  │
  ├─ /command-name ──→ Command template loaded
  │                     └──→ Routes to specified Agent
  │
  ├─ @agent-name ───→ Agent persona applied
  │                     ├── Model override
  │                     ├── Permission ruleset
  │                     └── System prompt injected
  │
  └─ context match ─→ Skills auto-loaded by trigger phrases

Agent executes
  │
  ├── Built-in tools (read, write, grep, shell)
  ├── Plugin tools (from opencode.json)
  ├── MCP tools (from connected servers)
  │
  ├── Permission required? ──→ Approval queue
  │                              │
  │                              ▼
  │                           User: once / always / reject
  │
  └── Output: Messages + Parts + Todos
                │
                ▼
         SSE Event Stream
         (message.created, part.updated, permission.requested, ...)
                │
                ▼
         SolidJS UI (fine-grained signal updates)
```

## Autonomous Systems

```
┌─────────────────────┐     ┌─────────────────────┐    ┌───────────────────┐
│   SOUL + HEARTBEAT  │     │   SCHEDULED JOBS     │    │   IDENTITIES      │
│                     │     │                     │    │   (Router)         │
│  .opencode/soul.md  │     │  Cron expressions   │    │                   │
│  ├── Goals          │     │                     │    │  ┌─────────────┐  │
│  ├── Focus          │     │  ┌───────────────┐  │    │  │  Telegram   │  │
│  ├── Loose ends     │     │  │ soul-heartbeat│──┼────┼──│  bot token  │  │
│  └── Preferences    │     │  │ 0 */12 * * *  │  │    │  └──────┬──────┘  │
│                     │     │  └───────────────┘  │    │         │         │
│  soul agent ────────┼────→│  ┌───────────────┐  │    │  ┌──────▼──────┐  │
│  (restricted perms) │     │  │ daily-report  │  │    │  │   Slack     │  │
│                     │     │  │ 0 9 * * 1-5   │  │    │  │  bot+app   │  │
│  heartbeat.jsonl ◄──┼─────│  └───────────────┘  │    │  │  tokens     │  │
│  ├── summary        │     │  ┌───────────────┐  │    │  └──────┬──────┘  │
│  ├── loose_ends[]   │     │  │ custom-job    │  │    │         │         │
│  └── next_action    │     │  │ user-defined  │  │    │         ▼         │
│                     │     │  └───────────────┘  │    │  Chat message     │
│  States:            │     │                     │    │    → Session      │
│  ● healthy (green)  │     │  Each job can:      │    │    → Agent exec   │
│  ● stale (amber)    │     │  ├── run a prompt   │    │    → Reply back   │
│  ● error (red)      │     │  ├── use an agent   │    │                   │
│  ○ off (gray)       │     │  └── override model │    │                   │
└─────────────────────┘     └─────────────────────┘    └───────────────────┘
```

## Runtime Architecture

```
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────────┐
│   OpenWork UI     │    │  OpenWork Server   │    │   OpenCode Engine     │
│   (SolidJS)       │    │  (Bun HTTP)        │    │   (SSE + REST)        │
│                   │    │                   │    │                       │
│  Dashboard        │    │  /skills (CRUD)    │    │  Session management   │
│  ├── Sessions     │◄──►│  /mcp (CRUD)       │◄──►│  Agent execution      │
│  ├── Skills       │    │  /commands (CRUD)  │    │  Tool dispatch        │
│  ├── Plugins      │    │  /scheduler (CRUD) │    │  Permission queue     │
│  ├── MCP          │    │  /soul (status)    │    │  Provider/model mgmt  │
│  ├── Scheduled    │    │  /workspace (CRUD) │    │  Event streaming      │
│  ├── Soul         │    │  /hub (catalog)    │    │  Hot reload           │
│  ├── Identities   │    │  /identities       │    │                       │
│  └── Settings     │    │                   │    │                       │
│                   │    │  Proxies to        │    │  Reads from:          │
│  Receives:        │    │  OpenCode for:     │    │  ├── .opencode/       │
│  SSE events ◄─────┼────┼── session/event    │    │  ├── opencode.json    │
│  (fine-grained    │    │   APIs             │    │  └── ~/.config/       │
│   SolidJS signals)│    │                   │    │      opencode/        │
└───────────────────┘    └───────────────────┘    └───────────────────────┘
         ▲
         │
┌────────┴──────────┐    ┌───────────────────┐
│  Tauri Shell      │    │  Providers         │
│  (Desktop only)   │    │                   │
│                   │    │  Anthropic ────────┼──→ Claude models
│  Native window    │    │  OpenAI ──────────┼──→ GPT models
│  Sidecar binaries │    │  Google ──────────┼──→ Gemini models
│  File system      │    │  Azure ───────────┼──→ Azure OpenAI
│  Secure storage   │    │  Custom ──────────┼──→ LiteLLM / Ollama
└───────────────────┘    └───────────────────┘
```

## Entity Relationships

```
Workspace ──┬── has many ──→ Sessions
            ├── has many ──→ Agents
            ├── has many ──→ Skills
            ├── has many ──→ Commands
            ├── has many ──→ Plugins
            ├── has many ──→ MCP Servers
            ├── has one  ──→ Soul
            ├── has many ──→ Scheduled Jobs
            └── has many ──→ Identities

Session ────┬── uses one ──→ Agent (per session, overridable)
            ├── uses one ──→ Provider + Model
            ├── contains  ──→ Messages → Parts → Todos
            └── queues    ──→ Permissions (approval flow)

Agent ──────┬── consumes  ──→ Skills (auto-loaded by context)
            ├── calls     ──→ Plugin tools
            ├── calls     ──→ MCP tools
            ├── calls     ──→ Built-in tools
            └── restricted by → Permission ruleset (tools allow/deny)

Command ────┬── routes to ──→ Agent (optional)
            ├── overrides ──→ Model (optional)
            └── invoked as ──→ /slash-command in Session

Skill ──────┬── loaded by ──→ /slash-command OR auto-trigger
            └── consumed by → Agent (as context/knowledge)

Soul ───────┬── memory in ──→ .opencode/soul.md
            ├── logs to   ──→ .opencode/soul/heartbeat.jsonl
            ├── runs via  ──→ Scheduled Job ("soul-heartbeat")
            └── uses      ──→ Soul Agent (restricted permissions)

Scheduled Job ┬── triggers ──→ Session (with prompt)
              ├── uses     ──→ Agent (optional)
              └── one special → Soul heartbeat job

Identity ───┬── bridges   ──→ Slack/Telegram ↔ Session
            └── uses      ──→ Agent (via router config)

MCP Server ──── exposes   ──→ Tools (consumed by Agents)

Plugin ──────── exposes   ──→ Tools (consumed by Agents)

Provider ────── provides  ──→ Models (used by Sessions/Agents)
```

## Entity Comparison

| Entity | What | Storage | Activation | Purpose |
|--------|------|---------|------------|---------|
| **Agent** | AI persona | `.opencode/agent/*.md` | `@name` in session | Model, permissions, behavior override |
| **Skill** | Knowledge doc | `.opencode/skills/*/SKILL.md` | `/name` or auto-trigger | Domain patterns and rules |
| **Command** | Prompt template | `.opencode/commands/*.md` | `/name` in composer | Reusable prompts, routes to agent |
| **Plugin** | Code tool | `opencode.json` + npm | Agent calls during execution | Extends tool capabilities |
| **MCP Server** | Tool provider | `opencode.json` under `mcp` | Agent calls during execution | Third-party integrations |
| **Soul** | Persistent memory | `.opencode/soul.md` + `soul/` | Heartbeat cron or manual | Cross-session awareness |
| **Scheduled Job** | Cron automation | `~/.config/opencode/scheduler/` | Time-based trigger | Unattended prompt execution |
| **Identity** | Chat bridge | Server-managed | Incoming Slack/Telegram message | Bidirectional messaging |
| **Provider** | LLM credentials | SDK-managed | Session creation | Model access |
| **Session** | Conversation | Engine-managed | User or automation creates | Messages, todos, permissions |
| **Workspace** | Project scope | `.opencode/` + `opencode.json` | User selects | Container for all entities |

## Data Flow Summary

```
Input Sources                    Engine                      Output
─────────────                    ──────                      ──────

User prompt ──────────┐
                      │
/command ─────────────┤
                      │
@agent ───────────────┤
                      ├──→ OpenCode Engine ──→ SSE Events ──→ UI
Scheduled job (cron) ─┤      │                                │
                      │      ├── Agent execution              ├── Messages
Identity (Slack/TG) ──┤      ├── Tool calls                   ├── Tool output
                      │      ├── Skill context                ├── Todos
Soul heartbeat ───────┘      └── Permission checks            ├── Permissions
                                                              └── Heartbeat log
```

All entities are **file-based and git-committable**. The entire agent/skill/command/soul setup travels with the repository, enabling reproducible AI workflows across team members and environments.
