# shipkit

**Code Development OS** — Multi-agent pipeline that makes AI coding agents produce production-ready, handoff-ready code.

34 skills · 14 agents · 6-phase gated pipeline · Works with 8 AI coding agents.

---

## Quick Install

```bash
# Auto-detect & install shipkit into EVERY AI agent on your machine (global)
npx @akakaui/shipkit init

# Install only in the current project (project-level override)
cd my-project
npx @akakaui/shipkit init --local

# See what's installed
npx @akakaui/shipkit detect
```

---

## How Installation Works

shipkit has **two install modes** that work together:

### 🌐 Global (`init` — no flags)

Installs into every AI coding agent it detects on your machine. Skills and agents go into each tool's config directory:

- `~/.config/opencode/skills/` + `agents/`
- `~/.claude/plugins/shipkit/`
- `~/.cursor/plugins/shipkit/`
- `~/.codex/plugins/shipkit/`
- `~/.cline/plugins/shipkit/`
- `~/.gemini/antigravity-cli/plugins/shipkit/`
- `~/.aider/rules/`
- `~/.windsurf/rules/`

Global = always available, every session, every project.

### 📁 Project-level (`init --local`)

Creates `.shipkit/` in your project folder. Overrides global when present:

```
my-project/
  .shipkit/
    agents/     ← project-specific agent overrides
    skills/     ← project-specific skill overrides
    shipkit.json ← metadata
```

Project-level = per-project customization on top of the global install.

**Both load simultaneously.** Global is always there. Project adds specificity.

---

## Per-Agent Installation

### OpenCode

OpenCode reads plugins from npm packages automatically. Skills and agents load from the package's own directories.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Or install via npm globally
npm install -g @akakaui/shipkit

# OpenCode auto-detects the package — restart and skills appear
```

**What gets installed:**
- `~/.config/opencode/skills/` — 34 SKILL.md files
- `~/.config/opencode/agents/` — 14 AGENT.md files  
- Skills load automatically on session start

**Usage in OpenCode:**
```
You: "build me a REST API"
  → @code router detects intent
  → routes to @backend agent
  → @backend uses testing.skill.md + modularity.skill.md
  → @tester runs quality gates
  → @deployer sets up CI/CD
```

---

### Claude Code

Claude Code loads plugins from `~/.claude/plugins/`.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Or tell Claude to load the plugin
claude /plugin install @akakaui/shipkit
```

**What gets installed:**
- `~/.claude/plugins/shipkit/plugin.json` — manifest with 7 skills + 14 agents
- Skills and agents available via `@` mentions

**Usage in Claude Code:**
```
You: "plan my project @planner"
  → Claude loads planner agent
  → Planner uses scope-classifier + feature-prioritizer skills
  → Produces plan.md with P0/P1/P2 features
  → Routes to @architect for stack selection
```

---

### Cursor

Cursor supports plugins via `~/.cursor/`.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Manual install
mkdir -p ~/.cursor/plugins/shipkit
cp -r ~/.cache/shipkit/* ~/.cursor/plugins/shipkit/
```

**What gets installed:**
- `~/.cursor/plugins/shipkit/plugin.json` — 7 skills with categories
- Skills available in Composer via `@` mentions

**Usage in Cursor Composer:**
```
"build a todo app using the pipeline"
  → Cursor loads shipkit orchestrator
  → @planner classifies scope
  → @architect designs architecture
  → @frontend + @backend build in parallel
  → @tester validates with 70%+ coverage
```

---

### Codex CLI

Codex CLI loads plugins from `~/.codex/plugins/`.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Manual install
mkdir -p ~/.codex/plugins/shipkit
cp -r ~/.cache/shipkit/* ~/.codex/plugins/shipkit/
```

**What gets installed:**
- `~/.codex/plugins/shipkit/plugin.json` — skills, agents, scaffold templates
- Codex loads them on startup

**Usage in Codex CLI:**
```
codex "generate a project using the shipkit pipeline"
  → Codex loads planner → architect → builder agents
  → All phases enforce quality gates
```

---

### Cline

Cline loads plugins from `~/.cline/plugins/`. shipkit installs **hooks** that fire before and after every tool Cline calls, enforcing quality gates automatically.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Manual install
mkdir -p ~/.cline/plugins/shipkit/{skills,agents,hooks}
cp -r ~/.cache/shipkit/skills/* ~/.cline/plugins/shipkit/skills/
cp -r ~/.cache/shipkit/agents/* ~/.cline/plugins/shipkit/agents/
```

**What gets installed:**
- `~/.cline/plugins/shipkit/cline-plugin.json` — manifest
- `~/.cline/plugins/shipkit/skills/` — 34 skill files
- `~/.cline/plugins/shipkit/agents/` — 14 agent configs
- `~/.cline/plugins/shipkit/hooks/pre-tool.js` — **runs quality gates before each tool call**
- `~/.cline/plugins/shipkit/hooks/post-tool.js` — **tracks tool usage for pipeline progress**

**The hook feature (Cline-specific):**

```
Before every tool call:
  pre-tool.js checks: is this tool safe? Are we in the right phase?
  
After every tool call:
  post-tool.js logs: what happened? Can we advance the pipeline?
```

**Usage in Cline:**
```
"shipkit: build a REST API"
  → Cline loads shipkit plugin
  → Pre-tool hook validates each action
  → @planner scopes → @architect designs → @backend builds
  → Post-tool hook tracks phase completion
  → Auto-advances through quality gates
```

---

### Antigravity

Antigravity loads plugins from `~/.gemini/antigravity-cli/plugins/`. Like Cline, shipkit installs **pre/post execution hooks**.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# Manual install
mkdir -p ~/.gemini/antigravity-cli/plugins/shipkit/{skills,agents,hooks}
cp -r ~/.cache/shipkit/skills/* ~/.gemini/antigravity-cli/plugins/shipkit/skills/
cp -r ~/.cache/shipkit/agents/* ~/.gemini/antigravity-cli/plugins/shipkit/agents/
```

**What gets installed:**
- `~/.gemini/antigravity-cli/plugins/shipkit/antigravity-plugin.json` — manifest
- `~/.gemini/antigravity-cli/plugins/shipkit/skills/` — 34 skills
- `~/.gemini/antigravity-cli/plugins/shipkit/agents/` — 14 agents
- `~/.gemini/antigravity-cli/plugins/shipkit/hooks/preToolUse.js` — **validates every action**
- `~/.gemini/antigravity-cli/plugins/shipkit/hooks/postToolUse.js` — **tracks pipeline state**

**The hook feature (Antigravity-specific):**

```
preToolUse.js — Runs before each tool execution
  - Verifies the tool is allowed in the current pipeline phase
  - Prevents out-of-order operations
  - Returns { allowed: true/false }

postToolUse.js — Runs after each tool execution  
  - Records the result for pipeline tracking
  - Detects phase completion
  - Signals pipeline to auto-advance
```

**Usage in Antigravity:**
```
"shipkit: deploy to production"
  → Antigravity runs shipkit's pre-tool hook
  → Hook verifies all quality gates passed
  → @deployer runs CI/CD pipeline
  → Post-tool hook marks deployment complete
  → @ops-monitor starts tracking
```

---

### Aider

**Aider has no plugin system.** shipkit integrates through convention-based rule files.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# The installer generates:
# ~/.aider/.aider.conf.yml  (loads skills as --read files)
# ~/.aider/rules/*.skill.md (each skill as a rule file)

# Manual install
mkdir -p ~/.aider/rules
cp -r ~/.cache/shipkit/skills/*/SKILL.md ~/.aider/rules/
```

**What gets installed:**
- `~/.aider/.aider.conf.yml` — config that auto-loads all skill rules
- `~/.aider/rules/` — one `.skill.md` file per skill, each with YAML frontmatter

**How YAML frontmatter works for Aider:**

Each skill rule file starts with metadata that tells Aider when to activate it:

```yaml
---
name: security-hardening
description: OWASP Top 10, auth hardening, encryption
trigger: always_on
---
```

**Usage in Aider:**
```bash
# Rules load automatically via .aider.conf.yml
aider

# Or load explicitly
aider --read ~/.aider/rules/production-hardening.skill.md \
      --read ~/.aider/rules/security.skill.md

# Then just talk naturally
"add authentication to this API"
  → Aider reads active skill rules
  → Security rules guide implementation
  → Production-hardening rules enforce quality
```

---

### Windsurf

**Windsurf has no plugin system.** shipkit integrates through `.windsurf/rules/*.windsurf-rule.md` files with YAML frontmatter.

```bash
# Global install (auto-detect)
npx @akakaui/shipkit init

# The installer generates:
# ~/.windsurf/rules/*.windsurf-rule.md (one per skill)

# Manual install
mkdir -p ~/.windsurf/rules
cp -r ~/.cache/shipkit/skills/*/SKILL.md ~/.windsurf/rules/
```

**What gets installed:**
- `~/.windsurf/rules/` — 34 `.windsurf-rule.md` files with YAML frontmatter

**How YAML frontmatter works for Windsurf:**

```yaml
---
name: db-scale
description: Connection pooling, read replicas, sharding
trigger: always_on
---
```

Trigger types you can use: `always_on`, `glob: "*.ts"`, `model_decision`, `manual`.

**Usage in Windsurf:**
```
"build a scalable database schema"
  → Windsurf loads always_on rules from shipkit
  → db-scale.skill.md guides schema design
  → security-hardening.skill.md ensures auth is correct
  → production-hardening.skill.md runs final checklist
```

---

## Hooks — What They Are, Why They Matter

Four of the 8 agents support hooks (pre/post tool execution). shipkit installs them automatically.

| Agent | Pre-Hook | Post-Hook | What it does |
|-------|----------|-----------|-------------|
| **Cline** | `pre-tool.js` | `post-tool.js` | Validates every action, logs pipeline progress |
| **Antigravity** | `preToolUse.js` | `postToolUse.js` | Enforces phase order, tracks completion |

**Without hooks:** The agent can call tools in any order, skip quality checks, jump phases.

**With hooks:** Every tool call is gated. You can't build before planning. You can't deploy before tests pass. The pipeline is enforced at the tool-call level.

For the other 4 agents (OpenCode, Claude Code, Cursor, Codex CLI), the pipeline is enforced at the **agent routing level** — the `@code` orchestrator decides which agent runs and in what order.

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

# Enable auto-advance (no gate approval prompts)
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
# Install shipkit into all detected AI coding agents (global)
npx shipkit init

# Install only in current project (project-level)
npx shipkit init --local

# Show every AI coding agent installed + shipkit status
npx shipkit detect

# List all agents
npx shipkit agents

# List all skills
npx shipkit skills

# Run quality gates on current project
npx shipkit quality

# Create a new project with CODE system
npx shipkit create my-app

# Advanced
npx shipkit route "build me a frontend"   # Test routing
npx shipkit convert --format md           # Convert skill formats
npx shipkit pipeline --status             # Check pipeline state
npx shipkit pipeline --auto               # Enable auto-advance
```

---

## Quality Gates

Run `npx shipkit quality` to check:

**Hard failures (must pass):**
- ❌ No `console.log`/`console.debug` in source
- ❌ No `TODO`/`FIXME`/`HACK` markers
- ❌ Files under 250 lines
- ❌ Functions under 50 lines

**Soft checks (should pass):**
- ✅ Tests exist
- ✅ package.json present
- ✅ README present
- ✅ .gitignore present
- ✅ License present

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
         │  8 AI Coding Agent Plugins      │
         │  OpenCode · Claude Code ·       │
         │  Cursor · Codex CLI ·           │
         │  Cline · Antigravity ·          │
         │  Aider · Windsurf               │
         └─────────────────────────────────┘
                    │
         ┌──────────┴──────────────────────┐
         │ 2 Install Modes                 │
         │  🌐 Global (~/.config/...)      │
         │  📁 Project  (.shipkit/)        │
         └─────────────────────────────────┘
```

---

## Example Session

```bash
# 1. Install shipkit (global — works in every AI code agent)
npx shipkit init
# Detects: OpenCode, Claude Code, Cursor, Codex CLI
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
| Core System (22 skills) | [@Akakaui](https://github.com/Akakaui) | MIT |
| Production Hardening (7 skills) | [@Akakaui](https://github.com/Akakaui) | MIT |
| domain-router, doc-coauthoring, frontend-design, ui-ux-pro-max, canvas-design | [sickn33](https://github.com/sickn33) via [antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | Apache 2.0 |

---

## License

MIT © [Akakaui](https://github.com/Akakaui)

External skills (from antigravity-awesome-skills by sickn33) are Apache 2.0.
