# CODE — Plan: The Pipeline

> **Status:** Draft for review
> **Owner:** @Akakaui
> **Next:** Review and approve before building

---

## 1. Vision

CODE is the **Code Development Operating System** — a complete pipeline that takes a project from idea to production, then keeps it running and evolving.

When someone runs `npx shipkit` or installs it as a plugin, they get:

1. **Scaffolding** — Instant project with the right stack
2. **Agents** — 11+ specialized AI agents that know exactly when to activate
3. **Pipeline** — A sequential workflow from planning → production → operations
4. **Adaptive Skills** — Production-hardening knowledge that loads based on what you're building and your expected scale
5. **GitHub/Prod Trackers** — Agents that never stop watching your PRs, issues, logs, and alerts

---

## 2. The Pipeline

The CODE pipeline defines the lifecycle of a project. Each phase has a required agent and gates before moving to the next.

```
[Inception] → [Plan] → [Spec] → [Build] → [Test] → [Deploy] → [Operate]
     │                                                                  │
     └────────────────────────── (loop back) ───────────────────────────┘
```

### Phase 0: Inception
| Field | Value |
|-------|-------|
| **Agent** | `@planner` |
| **Input** | User idea / problem statement |
| **Output** | Project brief + scope classification |
| **Gate** | Scope classified (SaaS, CLI, API, game, fun tool) |

### Phase 1: Plan
| Field | Value |
|-------|-------|
| **Agent** | `@planner` |
| **Input** | Project brief |
| **Output** | Feature list + priorities (P0/P1/P2) + effort estimate |
| **Skills loaded** | `scope-classifier`, `feature-prioritizer` |
| **Gate** | User approves feature scope |

### Phase 2: Architecture
| Field | Value |
|-------|-------|
| **Agent** | `@architect` |
| **Input** | Feature list + scope |
| **Output** | Stack decision, architecture diagram, data model, API design |
| **Skills loaded** | `stack-selector` |
| **Gate** | Architecture reviewed + approved |

### Phase 3: Build
| Field | Value |
|-------|-------|
| **Agents** | `@frontend`, `@backend`, `@mobile`, `@extension` |
| **Input** | Architecture spec |
| **Output** | Working code with tests |
| **Skills loaded** | `modularity`, `testing` |
| **Gate** | All P0/P1 features implemented, tests pass |

### Phase 4: Quality
| Field | Value |
|-------|-------|
| **Agents** | `@tester`, `@reviewer`, `@security` |
| **Input** | Built code |
| **Output** | Test reports, review findings, security audit |
| **Skills loaded** | `testing`, `security`, `performance` |
| **Gate** | 70%+ coverage, no high-severity findings |

### Phase 5: Deploy
| Field | Value |
|-------|-------|
| **Agent** | `@deployer` |
| **Input** | Reviewed + tested code |
| **Output** | CI/CD pipeline, staging + production deployment, monitoring |
| **Skills loaded** | `deployment`, `monitoring` |
| **Gate** | Production deployment successful, health checks passing |

### Phase 6: Operate
| Field | Value |
|-------|-------|
| **Agents** | `@ops-monitor`, `@github-tracker` |
| **Input** | Production system + GitHub repo |
| **Output** | Continuous monitoring, alerts, PR tracking, incident response |
| **Skills loaded** | `prod-ops`, `resilience-patterns` |
| **Gate** | (continuous — no end gate) |

---

## 3. Sub-Agents to Bundle

### 3.1 Core Agents (Already in scope)

| Agent | Role | Phase |
|-------|------|-------|
| `@code` | Master orchestrator — routes requests to the right agent | All phases |
| `@planner` | Requirements, scope, features, prioritization | 0, 1 |
| `@architect` | Stack, architecture, data modeling, API design | 2 |
| `@frontend` | UI components, state management, frontend logic | 3 |
| `@backend` | API endpoints, database, auth, business logic | 3 |
| `@mobile` | React Native / mobile implementation | 3 |
| `@extension` | Chrome extension (Manifest V3) | 3 |
| `@tester` | Unit, integration, e2e, security tests | 4 |
| `@reviewer` | Code review, quality gates, handoff readiness | 4, 6 |
| `@deployer` | CI/CD, infrastructure, domain, deployment | 5 |
| `@security` | Security audit, vulnerability scanning | 4 |

### 3.2 New Agents (To create)

| Agent | Role | Phase | Why |
|-------|------|-------|-----|
| `@github-tracker` | Watches PRs, issues, releases, changelog; notifies when things need attention | 6 | Never lose track of code health |
| `@ops-monitor` | Watches production logs, metrics, alerts, uptime; notifies on anomalies | 6 | Never lose track of your running app |
| `@auto-detect` | Detects project type, scale expectations, and loads relevant skills | 0 (before inception) | Adaptive skill loading engine |

---

## 4. Adaptive Production-Hardening Skills

### 4.1 How They Load

```
Project detection:
  package.json / requirements.txt / go.mod / Cargo.toml
        │
        ▼
  @auto-detect agent:
    - Is this a SaaS? CLI tool? API? Game? Fun tool?
    - Expected scale: solo / team / thousands / millions
    - Stack: Node? Python? Go? Rust?
        │
        ▼
  Loads appropriate skills:
    ├── Always: production-hardening (master orchestrator)
    ├── SaaS → ALL 7 sub-skills
    ├── CLI tool → resilience-patterns, prod-ops
    ├── API → infra-networking, db-scale, resilience-patterns
    ├── Game → performance, prod-ops
    ├── Fun tool → prod-ops (light)
    │
    └── Scale-aware additions:
        ├── Expected 1K+ users → container-orch, prod-ops
        ├── Expected 100K+ users → distributed-systems, infra-networking
        └── Expected 1M+ users → ALL skills + enterprise patterns
```

### 4.2 The 7 Production-Hardening Skills

| Skill | Loads When | What It Teaches |
|-------|-----------|-----------------|
| `production-hardening` (master) | Always | Orchestrates sub-skills, verifies checklist |
| `infra-networking` | SaaS, API, scaling projects | Load balancers, proxies, DNS, CDN, WAF |
| `container-orch` | SaaS, deployment-focused | Docker, K8s, Helm, Terraform, blue-green |
| `distributed-systems` | High-traffic, scaling | CAP, event-driven, saga, CQRS, pub/sub |
| `resilience-patterns` | All production projects | Circuit breaker, retry, timeout, rate limit |
| `db-scale` | Data-heavy (SaaS, API) | Indexing, sharding, connection pooling |
| `prod-ops` | All production projects | SLOs, incidents, on-call, DR, chaos |

### 4.3 Skill vs Agent Decision

The production-hardening skills are **skills, not agents** — passive knowledge that agents load when needed. 

- `@deployer` uses `infra-networking`, `container-orch`, `prod-ops`
- `@backend` uses `resilience-patterns`, `db-scale`, `distributed-systems`
- `@reviewer` uses `production-hardening` (master checklist)
- `@security` uses `production-hardening` (security checklist)
- `@ops-monitor` uses `prod-ops`, `resilience-patterns`

This means: **one agent can load multiple skills**, and **one skill can be used by multiple agents**.

---

## 5. The Two Operation Agents

### 5.1 `@github-tracker`

Watches your repository so you never lose track:

```
┌─────────────────────────────────┐
│ @github-tracker                 │
│                                 │
│ Watches:                        │
│  • Open PRs (stale, unreviewed) │
│  • Issues (untriaged, stale)    │
│  • CI failures (blocked PRs)    │
│  • Releases (changelog, tags)   │
│  • Dependencies (outdated, vuln)│
│                                 │
│ Notifies when:                  │
│  • PR has been open 3+ days     │
│  • Issue has no label           │
│  • CI is red on main            │
│  • New release is ready         │
│  • Dependency has CVE           │
└─────────────────────────────────┘
```

**Install:** Part of the global plugin. Watches any repo in the agent's context.

### 5.2 `@ops-monitor`

Watches your production system:

```
┌─────────────────────────────────┐
│ @ops-monitor                    │
│                                 │
│ Watches:                        │
│  • Logs (error spikes, patterns)│
│  • Metrics (latency, error rate)│
│  • Uptime (downtime, slow resp) │
│  • Alerts (PagerDuty, DataDog)  │
│  • Cost (usage spikes, waste)   │
│                                 │
│ Notifies when:                  │
│  • Error rate > 1%              │
│  • P99 latency increases 2x     │
│  • Service is down              │
│  • Monthly spend spikes 20%+    │
│  • SSL cert expires < 30 days   │
└─────────────────────────────────┘
```

**Install:** Activated when deployment phase completes and monitoring endpoints exist.

---

## 6. Distribution

### 6.1 Installers

```
Method 1: npm (recommended)
  npx @akakaui/shipkit@latest init

Method 2: curl installer (for non-Node users)
  curl -fsSL https://raw.githubusercontent.com/Akakaui/shipkit/main/installer.sh | sh

Method 3: Platform plugins
  /plugin install github.com/Akakaui/shipkit    (Claude Code)
  npm install @akakaui/shipkit                   (OpenCode)
  /add-plugin Akakaui/shipkit                    (Cursor)
```

### 6.2 Plugin Manifests

| File | Platform | Purpose |
|------|----------|---------|
| `.claude-plugin/plugin.json` | Claude Code | Registers agents + skills |
| `.codex-plugin/plugin.json` | Codex CLI | Registers skills for Codex |
| `.cursor-plugin/plugin.json` | Cursor | Registers skills for Cursor |
| `opencode-plugin.json` | OpenCode | npm plugin manifest |
| `package.json` | npm | Publishes to npm registry |

### 6.3 Marketplace Publishing

| Marketplace | URL |
|-------------|-----|
| npm | `npmjs.com/package/@akakaui/shipkit` |
| SkillsMP | `skillsmp.com/creators/Akakaui` |
| Claude Marketplace | Via plugin.json + marketplace.json |

---

## 7. Files to Create/Modify

```
shipkit/
├── installer.sh                    NEW — Universal installer script
├── PLAN.md                         NEW — This document
├── PIPELINE.md                     NEW — Pipeline definition file
├── README.md                       UPDATE — Add plugin install instructions
├── package.json                    UPDATE — Add "plugin" entry point
│
├── skills/                         NEW — 7 production-hardening skills
│   ├── production-hardening/SKILL.md
│   ├── infra-networking/SKILL.md
│   ├── container-orch/SKILL.md
│   ├── distributed-systems/SKILL.md
│   ├── resilience-patterns/SKILL.md
│   ├── db-scale/SKILL.md
│   └── prod-ops/SKILL.md
│
├── agents/                         NEW — All agent definitions
│   ├── code/AGENT.md               Orchestrator
│   ├── planner/AGENT.md
│   ├── architect/AGENT.md
│   ├── frontend/AGENT.md
│   ├── backend/AGENT.md
│   ├── mobile/AGENT.md
│   ├── extension/AGENT.md
│   ├── tester/AGENT.md
│   ├── reviewer/AGENT.md
│   ├── deployer/AGENT.md
│   ├── security/AGENT.md
│   ├── github-tracker/AGENT.md     NEW
│   ├── ops-monitor/AGENT.md        NEW
│   └── auto-detect/AGENT.md        NEW
│
├── profiles/                       NEW — Auto-detection profiles
│   ├── detect.sh
│   ├── saas.json
│   ├── cli-tool.json
│   ├── api-service.json
│   ├── game.json
│   └── fun-tool.json
│
├── .claude-plugin/                 NEW — Claude Code plugin manifest
│   ├── plugin.json
│   └── marketplace.json
│
├── .codex-plugin/plugin.json       NEW — Codex CLI plugin manifest
├── .cursor-plugin/plugin.json      NEW — Cursor plugin manifest
├── opencode-plugin.json            NEW — OpenCode plugin manifest
│
└── templates/                      EXISTING — Keep templates
    ├── agent/AGENT.md
    ├── skill/SKILL.md
    └── tool/README.md
```

---

## 8. Build Order

The order matters — each step builds on the previous:

```
Step 1:  PIPELINE.md        — Pipeline definition (the "source of truth")
Step 2:  agents/             — All agent files
Step 3:  skills/              — Production-hardening skills
Step 4:  profiles/            — Auto-detection system
Step 5:  installer.sh         — Universal installer
Step 6:  plugin manifests     — Platform wrappers (.claude-plugin, etc.)
Step 7:  package.json update  — npm publish ready
Step 8:  README update        — Documentation
Step 9:  Publish              — npm + GitHub
```

---

## 9. Decisions

| Question | Decision |
|----------|----------|
| **Pipeline control** | **Ask at each gate by default.** User can explicitly say "run autonomously" to let CODE auto-advance without asking. |
| **Agent format** | **AGENT.md with YAML frontmatter** — same convention as SKILL.md. Name, description, allowed-tools, instructions. |
| **Skill split** | **Keep 7 skills** as defined. Each has a clear owner agent and trigger profile. |
| **Tracker state** | **Chat-context + MCP connectors.** Trackers fetch live data when user is active (via MCP/CLI). No persistent server — when PC is off, nothing runs. On reconnect, trackers re-fetch current state. |
| **Ops monitor depth** | **Start with URL/HTTP health checks.** Add MCP connector interface so user can optionally connect Datadog, Sentry, Vercel, PagerDuty, etc. |

## 10. Build Order

| Step | What | Depends on |
|------|------|-----------|
| 1 | `PIPELINE.md` — Pipeline definition (source of truth) | Nothing |
| 2 | `agents/` — All 14 agent AGENT.md files | PIPELINE.md |
| 3 | `skills/` — 7 production-hardening skills | Nothing (can parallel with agents) |
| 4 | `profiles/` — Auto-detection system (detect.js + profiles) | agents/ (auto-detect agent) |
| 5 | `installer.sh` — Universal installer | skills/ + agents/ |
| 6 | Plugin manifests — `.claude-plugin/`, `.cursor-plugin/`, etc. | agents/ + skills/ |
| 7 | `package.json` update — npm entry point | installer.sh |
| 8 | `README.md` update — Documentation | Everything above |
| 9 | Publish — npm + GitHub tag | All done |
