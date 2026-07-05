# shipkit

**Code Development OS** — Multi-agent pipeline for production-ready code from AI coding agents.

34 skills · 14 agents · 6-phase gated pipeline · Works with 9 AI coding tools.

---

## Quick Start

```bash
# Auto-detect & install shipkit into your AI coding agent
npx @akakaui/shipkit init
```

Or install locally for a project:

```bash
cd my-project
npx @akakaui/shipkit init --local
```

---

## The Pipeline

shipkit runs a 6-phase gated pipeline, auto-advancing through gates:

```
[Detect] → [Plan] → [Architect] → [Build] → [Quality] → [Deploy] → [Operate]
  Phase -1    P0-1       P2           P3          P4          P5         P6
```

Each phase has a **gate** that checks readiness before advancing. By default, gates ask for approval. Say **"run autonomously"** to fast-track.

| Phase | Agent | Gate |
|-------|-------|------|
| **Auto-Detect** | `@auto-detect` | Profile confirmed |
| **Inception** | `@planner` | Brief approved |
| **Plan** | `@planner` | Plan approved |
| **Architecture** | `@architect` | Architecture approved |
| **Build** | `@frontend`/`@backend`/`@mobile`/`@extension` | All P0 built + tests pass |
| **Quality** | `@tester`/`@security`/`@reviewer` | QA pass (70%+ coverage, 0 high) |
| **Deploy** | `@deployer` | Production healthy |
| **Operate** | `@ops-monitor`/`@github-tracker` | Continuous |

### Pipeline Commands

```bash
# Check pipeline state
npx shipkit pipeline --status

# Enable auto-advance
npx shipkit pipeline --auto

# Advance to next phase
npx shipkit pipeline --advance

# Skip to a specific phase
npx shipkit pipeline --skip-to 3
```

---

## Agents (14)

| Agent | Role | Phase |
|-------|------|-------|
| `@code` | Master orchestrator — routes requests to sub-agents | All |
| `@auto-detect` | Classifies project type, loads skills | -1 |
| `@planner` | Requirements, scope, features | 0–1 |
| `@architect` | Stack, data model, API design | 2 |
| `@frontend` | UI components, state, routing | 3 |
| `@backend` | APIs, databases, auth | 3 |
| `@mobile` | React Native / Expo apps | 3 |
| `@extension` | Chrome Manifest V3 extensions | 3 |
| `@tester` | Unit, integration, E2E tests | 4 |
| `@security` | Vulnerability scanning, OWASP | 4 |
| `@reviewer` | Code quality, handoff readiness | 4, 6 |
| `@deployer` | CI/CD, infra, monitoring | 5 |
| `@github-tracker` | PRs, issues, releases, CI | 6 |
| `@ops-monitor` | Logs, metrics, uptime, alerts | 6 |

---

## Skill Catalog (34)

Skills are organized in three groups. Each is a self-contained `SKILL.md` file that your AI coding agent loads on demand.

### 🔧 Core System — CODE Infrastructure

Created by [@Akakaui](https://github.com/Akakaui). MIT license.

| Skill | Description |
|-------|-------------|
| **bootstrap** | Session initialization and system startup |
| **cleanup** | End-of-session cleanup and state reset |
| **code-cleanup** | Remove dead code, reduce technical debt |
| **confirmation** | Mandatory approval before irreversible actions |
| **context-manager** | Project state tracking across sessions |
| **deployment** | Environments, CI/CD, rollback strategies |
| **distributed-systems** | Patterns for distributed system design |
| **document** | Structured proposals, reports, and formal docs |
| **documentation** | README, API docs, architecture documentation |
| **feature-prioritizer** | P0/P1/P2/P3 feature classification |
| **git-workflow** | Branch strategy, commits, PR conventions |
| **handoff** | 30-minute rule, handoff readiness checklist |
| **modularity** | File naming, structure, 250-line limit |
| **monitoring** | Logging, error tracking, alerting |
| **performance** | Optimization, bundle size, profiling |
| **scope-classifier** | Project type & scope classification |
| **security** | Security checklist and best practices |
| **skill-creator** | Create new agent skill files |
| **skill-scanner** | Discover available skills and templates |
| **stack-selector** | Technology stack selection |
| **testing** | Test generation and coverage targets |
| **tools** | Installed tools and system capabilities |

External — by [sickn33](https://github.com/sickn33) via [antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills). Apache 2.0.

| Skill | Description |
|-------|-------------|
| **doc-coauthoring** | Structured workflow for co-authoring documentation, proposals, specs |
| **domain-router** | Route requests to domain-specific knowledge collections |

### 🏗️ Production Hardening

Created by [@Akakaui](https://github.com/Akakaui). MIT license.

| Skill | Description |
|-------|-------------|
| **production-hardening** | Master checklist — coordinates all prod-hardening sub-skills |
| **infra-networking** | CDN, DNS, WAF, load balancers, SSL, DDoS, multi-region |
| **container-orch** | Docker, Compose, Kubernetes, Helm, service discovery |
| **db-scale** | Connection pooling, read replicas, sharding, migrations, query perf |
| **resilience-patterns** | Rate limiting, circuit breakers, retries, graceful degradation |
| **security-hardening** | OWASP Top 10, auth, encryption, SBOM, compliance |
| **prod-ops** | Monitoring, alerting, SLOs, incident response, cost optimization |

### 🎨 Frontend & UI

External — by [sickn33](https://github.com/sickn33) via [antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills). Apache 2.0.

| Skill | Description |
|-------|-------------|
| **canvas-design** | Create visual art in .png and .pdf using design philosophy |
| **frontend-design** | Distinctive, intentional visual design guidance |
| **ui-ux-pro-max** | UI/UX catalog reference for design patterns |

---

## Commands

```bash
# Install shipkit into detected AI coding agents
npx shipkit init

# Install locally in current project only
npx shipkit init --local

# Detect which AI coding agents are present
npx shipkit detect

# Test route a request to see which agent handles it
npx shipkit route "build me a frontend"

# Run quality gates on current project
npx shipkit quality

# List all agents
npx shipkit agents

# List all skills
npx shipkit skills

# Create a new project with CODE system
npx shipkit create my-app

# Convert skills to another format
npx shipkit convert --format md
```

---

## Quality Gates

Run `npx shipkit quality` to check:

- ❌ No `console.log`/`console.debug` in source
- ❌ No `TODO`/`FIXME`/`HACK` markers
- ❌ Files under 250 lines
- ❌ Functions under 50 lines
- ✅ Tests exist
- ✅ package.json present
- ✅ README present
- ✅ .gitignore present
- ✅ License present

---

## How It Works Per Agent

shipkit's `npx shipkit init` auto-detects which AI coding agent you're using and installs into its plugin system. Here's how each agent loads shipkit:

### 1. OpenCode

OpenCode reads skills from `~/.config/opencode/skills/` and agents from `~/.config/opencode/agents/`.

**Flow:**
1. `npx shipkit init` detects OpenCode via `OPENCODE_PLUGIN_DIR` env or config file
2. Copies all 34 `SKILL.md` files → `~/.config/opencode/skills/<name>.skill.md`
3. Copies 14 `AGENT.md` files → `~/.config/opencode/agents/<name>/AGENT.md`
4. User opens OpenCode → skills auto-load → `@code` orchestrator routes requests

**How a session works:**
```
User: "build me a REST API"
  → @code router detects intent → routes to @backend agent
  → @backend loads testing.skill.md, modularity.skill.md
  → Agent builds API following skills
  → @tester runs quality gates
  → @deployer sets up CI/CD
```

### 2. Claude Code

Claude Code loads plugins from `~/.claude/plugins/`.

**Flow:**
1. `npx shipkit init` detects Claude Code
2. Creates `~/.claude/plugins/shipkit/` with all skills and agents
3. User opens Claude Code → `/plugin list` shows shipkit
4. Skills are available via `@` mentions

**How a session works:**
```
User: "plan my project @planner"
  → Claude Code loads planner agent
  → Planner uses scope-classifier + feature-prioritizer skills
  → Produces plan.md with P0/P1/P2 features
  → Code reviews plan, routes to @architect
  → Architect uses stack-selector skill
```

### 3. Cursor

Cursor supports plugins via `~/.cursor/` config.

**Flow:**
1. `npx shipkit init` detects Cursor
2. Updates `~/.cursor/config.json` with shipkit paths
3. Skills and agents are available in Cursor Composer
4. User can `@code` to route requests

### 4. Codex CLI

Codex CLI reads plugins from `~/.codex/plugins/`.

**Flow:**
1. `npx shipkit init` detects Codex CLI
2. Creates `~/.codex/plugins/shipkit/` with all skills/agents
3. Codex CLI loads them on startup
4. User types `@code build the ui` → orchestrator routes

### 5. Aider

Aider reads skills from `~/.aider/skills/`.

**Flow:**
1. `npx shipkit init` detects Aider
2. Copies all skills to `~/.aider/skills/`
3. Aider loads skills on session start
4. Skills guide Aider's code generation toward production quality

### 6. Windsurf

Windsurf supports plugins in `~/.windsurf/`.

**Flow:**
1. `npx shipkit init` detects Windsurf
2. Installs shipkit into Windsurf plugin system
3. Skills available as contextual guidance
4. Pipeline gates enforce quality checks

### 7. Cline

Cline loads plugins from `~/.cline/plugins/`.

**Flow:**
1. `npx shipkit init` detects Cline
2. Installs into Cline plugin directory
3. Skills available on `@agent` mention
4. Pipeline engine manages multi-phase builds

### 8. Gemini CLI

Gemini CLI loads plugins from `~/.gemini/plugins/`.

**Flow:**
1. `npx shipkit init` detects Gemini CLI
2. Installs shipkit as a Gemini plugin
3. `@code` routes requests to sub-agents
4. Quality gates run after each phase

### 9. Antigravity

Antigravity loads plugins from `~/.antigravity/plugins/`.

**Flow:**
1. `npx shipkit init` detects Antigravity
2. Installs into Antigravity plugin system
3. All 34 skills available on demand
4. Pipeline phases auto-advance through gates

---

## Architecture

```
         ┌─────────────┐
         │   @code      │  Master orchestrator (router.js)
         │  (AGENT.md)  │  routes to sub-agents
         └──────┬──────┘
                │
         ┌──────┴──────────────────────────┐
         │           Pipeline              │
         │  6-phase gated engine (pipeline.js)  │
         └──────────┬──────────────────────┘
                    │
         ┌──────────┴──────────────────────┐
         │     34 Skills (SKILL.md)        │
         │  Core · Prod-Hardening · UI     │
         └─────────────────────────────────┘
                    │
         ┌──────────┴──────────────────────┐
         │  14 Agents (AGENT.md)           │
         │  Planner · Architect · Builder  │
         │  Tester · Deployer · Monitor    │
         └─────────────────────────────────┘
                    │
         ┌──────────┴──────────────────────┐
         │  9 AI Coding Agent Plugins      │
         │  OpenCode · Claude · Cursor ·  │
         │  Codex · Aider · Windsurf ·     │
         │  Cline · Gemini · Antigravity   │
         └─────────────────────────────────┘
```

---

## Example Session

```bash
# 1. Install shipkit
npx shipkit init
# Detects: OpenCode, Claude Code
# Installs 34 skills, 14 agents into each

# 2. Start your AI coding agent and type:
# "build me a todo app"

# 3. @code orchestrator routes to @planner
# Planner uses scope-classifier → identifies as "Lightweight Web App"
# Planner uses feature-prioritizer → P0: CRUD, P1: auth, P2: search

# 4. Routes to @architect
# Architect uses stack-selector → recommends React + Express + SQLite

# 5. Routes to @frontend + @backend
# Build agents use modularity + testing skills
# Code stays under 250 lines, tests generated alongside

# 6. @tester runs tests
# Quality gates: 70%+ coverage, 0 high issues

# 7. @deployer sets up CI/CD
# Production deployment with monitoring

# Done. Production-ready code, every time.
```

---

## Credits

shipkit bundles skills from multiple authors under their respective licenses:

| Skills | Author | License |
|--------|--------|---------|
| Core System (23 skills) | [@Akakaui](https://github.com/Akakaui) | MIT |
| Production Hardening (7 skills) | [@Akakaui](https://github.com/Akakaui) | MIT |
| domain-router, doc-coauthoring, frontend-design, ui-ux-pro-max, canvas-design | [sickn33](https://github.com/sickn33) via [antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | Apache 2.0 |

---

## License

MIT © [Akakaui](https://github.com/Akakaui)

External skills (from antigravity-awesome-skills by sickn33) are Apache 2.0.
