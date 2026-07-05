# create-code

**Code Development OS** — A cross-platform plugin system for AI coding tools.

14 agents, 7 production-hardening skills, adaptive auto-detection. Works on **OpenCode**, **Claude Code**, **Cursor**, and **Codex CLI**.

---

## Quick Install

```bash
# Auto-detect & install (Linux/macOS)
curl -fsSL https://raw.githubusercontent.com/Akakaui/create-code/main/installer.sh | bash

# npm global
npm i -g @akakaui/create-code

# Or add to your project
npm i -D @akakaui/create-code
```

### Platform-Specific

| Platform | Command |
|----------|---------|
| OpenCode | `npm i @akakaui/create-code` (auto-detected via `package.json`) |
| Claude Code | `/plugin install github.com/Akakaui/create-code` |
| Cursor | `/add-plugin Akakaui/create-code` |
| Codex CLI | `codex plugins add @akakaui/create-code` |

---

## The Pipeline

The system follows 6 phases, auto-advancing through gates:

```
Auto-Detect  →  Plan  →  Architect  →  Build  →  Test  →  Deploy  →  Operate
(Phase -1)    (P1)      (P2)          (P3)      (P4)     (P5)       (P6)
```

- **Auto-Detect** — Scans your project, classifies type (SaaS, API, CLI, mobile, etc.)
- **Plan** — Gathers requirements, defines features, sets scope
- **Architect** — Selects stack, designs data model, plans API
- **Build** — Routes to the right agent (frontend, backend, mobile, extension)
- **Test** — Writes + runs tests, security audit, code review
- **Deploy** — CI/CD, infrastructure, monitoring
- **Operate** — GitHub tracker, ops monitor (continuous)

Each phase asks before advancing by default. Say **"run autonomously"** to fast-track.

---

## Agents (14)

| Agent | Role | Phase |
|-------|------|-------|
| `@auto-detect` | Classifies project type, loads right skills | -1 |
| `@planner` | Requirements, scope, features | 1 |
| `@architect` | Stack, data model, API design | 2 |
| `@frontend` | UI components, state, routing | 3 |
| `@backend` | APIs, databases, auth | 3 |
| `@mobile` | React Native / Expo apps | 3 |
| `@extension` | Chrome Manifest V3 extensions | 3 |
| `@tester` | Unit, integration, E2E tests | 4 |
| `@security` | Vulnerability scanning, SOC 2, OWASP | 4 |
| `@reviewer` | Code quality, handoff readiness | 4, 6 |
| `@deployer` | CI/CD, infra, monitoring | 5 |
| `@github-tracker` | PRs, issues, releases, CI status | 6 |
| `@ops-monitor` | Logs, metrics, uptime, alerts | 6 |
| `@code` | Master orchestrator — routes to sub-agents | All |

---

## Production-Hardening Skills (7)

Auto-loaded by project profile. Each is a self-contained `SKILL.md` with checklists, patterns, and runbooks.

| Skill | What it covers |
|-------|---------------|
| **production-hardening** | Master checklist — coordinates all sub-skills |
| **infra-networking** | CDN, DNS, WAF, load balancers, SSL, DDoS, multi-region |
| **container-orch** | Docker, Compose, Kubernetes, Helm, service discovery |
| **db-scale** | Connection pooling, read replicas, sharding, migrations, query perf |
| **resilience-patterns** | Rate limiting, circuit breakers, retries, graceful degradation |
| **security-hardening** | OWASP Top 10, auth, encryption, SBOM, compliance |
| **prod-ops** | Monitoring, alerting, SLOs, incident response, cost |

### Auto-Loading

The `@auto-detect` agent selects skills based on project type and scale:

| Profile | Skills loaded | Example |
|---------|--------------|---------|
| SaaS | All 7 | Dashboard with auth, billing |
| API (low/med) | infra-networking, resilience, db-scale, prod-ops | Public API |
| API (high/enterprise) | All 7 | High-traffic API |
| CLI tool | resilience, prod-ops | `gh`-style CLI |
| Mobile | resilience, prod-ops | React Native app |
| Extension | prod-ops (light) | Chrome extension |
| Game | prod-ops (light) | Phaser/Three.js game |
| Fun tool | Minimal | Side project |

Override auto-detection by creating `create-code.json` in your project root:

```json
{
  "profile": "saas",
  "scale": "enterprise",
  "skills": ["production-hardening", "infra-networking", "security-hardening"]
}
```

---

## Auto-Detection Profiles

Profiles live in `profiles/` and map project structure → skills + recommendations:

```json
// profiles/saas.json
{
  "name": "saas",
  "detection": { "keywords": ["stripe", "auth", "multi-tenant", "subscription", ...] },
  "skills": { "all": ["production-hardening", ...] },
  "recommendations": { "medium": ["Add read replicas", ...] }
}
```

8 built-in profiles: `saas`, `api`, `cli-tool`, `mobile`, `extension`, `game`, `fun-tool`, `enterprise`.

---

## Pipeline Control

By default, the pipeline **asks at each gate**. This means you stay in control:

```
🟡 Gate: Ready to plan? [y/N]
🟢 Gate: Architecture approved? [y/N]
🟡 Gate: Ready to build? [y/N]
🟡 Gate: Tests passing, deploy? [y/N]
```

Say **"run autonomously"** to fast-track through all gates automatically. Say **"pause at deploy"** to stop only before production pushes.

---

## What's Included

### In your project (after install)

```
project/
├── .claude-plugin/plugin.json        # Claude Code manifest
├── .cursor-plugin/plugin.json        # Cursor manifest
├── .codex-plugin/plugin.json         # Codex CLI manifest
├── opencode-plugin.json              # OpenCode manifest
├── agents/                           # 14 AGENT.md files
│   ├── code/AGENT.md
│   ├── planner/AGENT.md
│   ├── auto-detect/AGENT.md
│   └── ...
├── skills/                           # 7 SKILL.md files
│   ├── production-hardening/SKILL.md
│   ├── infra-networking/SKILL.md
│   └── ...
├── profiles/                         # 8 auto-detection profiles
│   ├── saas.json
│   ├── api.json
│   └── ...
├── PIPELINE.md                        # Pipeline definition
├── PLAN.md                            # Full architecture
└── installer.sh                       # Universal installer
```

### Scaffolded project (via `npx @akakaui/create-code my-app`)

```
my-app/
├── src/
├── tests/
├── .github/workflows/
├── agents/                           # Project-level agents
├── skills/                           # Project-level skills (15 base skills)
├── .claude-plugin/
├── .cursor-plugin/
├── package.json
└── README.md
```

---

## Scaffolding Commands

```bash
# Create new project
npx @akakaui/create-code my-app

# Skip prompts
npx @akakaui/create-code my-app --type web --scope lightweight

# Skip git init
npx @akakaui/create-code my-app --no-git

# Skip npm install
npx @akakaui/create-code my-app --no-install

# Init in existing project (installs agents + skills only)
npx @akakaui/create-code init

# List agents
npx @akakaui/create-code agents

# List skills
npx @akakaui/create-code skills
```

---

## Quality Standards

- TypeScript strict mode
- ESLint + Prettier
- Vitest with 70%+ coverage target
- 250-line file limit
- 50-line function limit
- Conventional commits
- CI/CD via GitHub Actions

---

## Architecture

```
        ┌─────────────┐
        │   @code      │  Master orchestrator
        │  (AGENT.md)  │
        └──────┬──────┘
               │ routes to
        ┌──────┴──────────────────────┐
        │         Pipeline            │
        │  ┌───┐ ┌──┐ ┌───┐ ┌──┐ ┌──┐│
        │  │ P1 │ │P2│ │P3 │ │P4│ │P5││
        │  └───┘ └──┘ └───┘ └──┘ └──┘│
        └─────────────────────────────┘
               │ loads
        ┌──────┴──────────────────────┐
        │     Production Skills       │
        │  7 SKILL.md files           │
        └─────────────────────────────┘
               │ detects
        ┌──────┴──────────────────────┐
        │   Auto-Detect Profiles      │
        │  8 profile.json files       │
        └─────────────────────────────┘
```

---

## Trackers

### `@github-tracker`
Watches PRs, issues, releases, CI status, dependencies. Uses `gh` CLI.

### `@ops-monitor`
Watches uptime, errors, latency, SSL, cost, security. Starts with HTTP checks, optionally connects Sentry, Datadog, Vercel, PagerDuty via MCP.

Both work in chat context — no persistent server. Re-fetch on each session.

---

## Why Cross-Platform?

The **Agent Skills** format is an open standard stewarded by the Agentic AI Foundation (AAIF) under the Linux Foundation, alongside MCP. 30+ tools support the same `SKILL.md` format:

OpenCode, Claude Code, Codex CLI, Gemini CLI, Cursor, GitHub Copilot, Windsurf, Goose, Kiro, and more.

**Install once, use everywhere.**

---

## License

MIT © Akakaui
