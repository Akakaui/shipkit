# CODE Pipeline Definition

> **Source of truth** for the Code Development Operating System.
> All agents, skills, and profiles reference this document.
> Version: 1.0.0

---

## 1. Phases

The pipeline has 6 phases + 1 meta-phase (Auto-Detect).

```
[Auto-Detect] → [Inception] → [Plan] → [Architect] → [Build] → [Test] → [Deploy] → [Operate]
      │                                                                                      │
      └──────────────────────────── (feature loop) ──────────────────────────────────────────┘
```

### Phase -1: Auto-Detect

Runs before inception. Determines **what** this project is and **what skills** it needs.

| Field | Value |
|-------|-------|
| **Agent** | `@auto-detect` |
| **When** | On project creation OR when `@code detect` is called |
| **Input** | Project files (package.json, README, src/ structure) |
| **Output** | `profile.json` — project type + scale + skill map |
| **Gate** | Profile verified by user (or auto-confirmed if profile matches) |

**Detection rules:**

```
Read package.json / requirements.txt / Cargo.toml / go.mod / pyproject.toml
  ├── Has "next", "react", "vue", "angular" deps?  → web frontend
  ├── Has "express", "fastify", "django", "flask"?  → web backend
  ├── Has "react-native", "expo", "flutter"?         → mobile
  ├── Has "electron", "tauri"?                        → desktop
  └── No framework deps?                              → CLI tool / library

Read scripts / bin sections
  ├── Has "build", "deploy", "start"?                → web app (SaaS-like)
  ├── Has "cli", "bin"?                               → CLI tool
  └── Minimal scripts?                                → fun tool / experiment

Check scale indicators
  ├── Mentions "million users", "scale", "enterprise" → high scale
  ├── Mentions "team", "multi-tenant"?                → medium scale
  └── Mentions "hobby", "personal", "fun"?            → low scale
```

**Skill loading by profile:**

| Profile | Skills Loaded |
|---------|--------------|
| **SaaS / Web App** | production-hardening, infra-networking, container-orch, distributed-systems, resilience-patterns, db-scale, prod-ops |
| **API Service** | production-hardening, infra-networking, resilience-patterns, db-scale, prod-ops |
| **CLI Tool** | production-hardening, resilience-patterns, prod-ops |
| **Mobile App** | production-hardening, resilience-patterns, prod-ops (light) |
| **Game** | production-hardening, prod-ops (light) |
| **Fun Tool / Experiment** | production-hardening (light) |
| **Enterprise / 1M+ users** | ALL skills + extra enterprise patterns |

### Phase 0: Inception

| Field | Value |
|-------|-------|
| **Agent** | `@planner` |
| **Skills loaded** | `scope-classifier` |
| **Input** | User idea / problem statement / URL |
| **Output** | `brief.md` — Project brief with goal, audience, success metrics |
| **Gate** | User approves brief |
| **Control** | ALWAYS ask before proceeding |

### Phase 1: Plan

| Field | Value |
|-------|-------|
| **Agent** | `@planner` |
| **Skills loaded** | `scope-classifier`, `feature-prioritizer` |
| **Input** | `brief.md` from Inception |
| **Output** | `plan.md` — Features (P0/P1/P2), milestones, effort estimates |
| **Gate** | User approves feature scope + milestone order |
| **Control** | ALWAYS ask before proceeding |

### Phase 2: Architecture

| Field | Value |
|-------|-------|
| **Agent** | `@architect` |
| **Skills loaded** | `stack-selector`, (production-hardening sub-skills based on profile) |
| **Input** | `plan.md` + `profile.json` |
| **Output** | `architecture.md` — Stack, data model, API design, infra decisions |
| **Gate** | Architecture reviewed and approved |
| **Control** | ALWAYS ask before proceeding |

### Phase 3: Build

| Field | Value |
|-------|-------|
| **Agents** | `@frontend`, `@backend`, `@mobile`, `@extension` (based on profile) |
| **Skills loaded** | `modularity`, `testing`, (production-hardening sub-skills) |
| **Input** | `architecture.md` |
| **Output** | Working code + tests |
| **Gate** | All P0 features implemented + all tests passing |
| **Control** | Auto-advance unless user intervenes |

### Phase 4: Quality

| Field | Value |
|-------|-------|
| **Agents** | `@tester`, `@reviewer`, `@security` |
| **Skills loaded** | `testing`, `security`, `performance` |
| **Input** | Built code |
| **Output** | `qa-report.md` — Coverage, issues, vulnerabilities, review findings |
| **Gate** | 70%+ coverage, 0 high-severity issues, all P0/P1 tested |
| **Control** | ALWAYS show report before proceeding |

### Phase 5: Deploy

| Field | Value |
|-------|-------|
| **Agent** | `@deployer` |
| **Skills loaded** | `deployment`, `monitoring`, `infra-networking`, `container-orch`, `prod-ops` |
| **Input** | `qa-report.md` + `architecture.md` |
| **Output** | CI/CD config, staging deploy, production deploy, monitoring dashboard |
| **Gate** | Production health checks passing + monitoring active |
| **Control** | ALWAYS ask before deploying to production. Ask once for staging. |

### Phase 6: Operate

| Field | Value |
|-------|-------|
| **Agents** | `@ops-monitor`, `@github-tracker` |
| **Skills loaded** | `prod-ops`, `resilience-patterns` |
| **Input** | Production URLs + GitHub repo |
| **Output** | Continuous status reports, alerts, PR summaries |
| **Gate** | (continuous — no end gate) |
| **Control** | Reports on request OR on significant events. Never spams. |

---

## 2. Agent Routing Table

This is how `@code` (the orchestrator) decides which sub-agent to route to:

| User says | Route to | Phase |
|-----------|----------|-------|
| "Plan my project" / "I have an idea" | `@planner` | 0, 1 |
| "Detect what I'm building" / "profile this" | `@auto-detect` | -1 |
| "Choose my stack" / "design architecture" | `@architect` | 2 |
| "Build the UI" / "make the frontend" | `@frontend` | 3 |
| "Build the API" / "set up the backend" | `@backend` | 3 |
| "Build the mobile app" | `@mobile` | 3 |
| "Build the extension" | `@extension` | 3 |
| "Write tests" / "run tests" | `@tester` | 4 |
| "Review my code" / "is it ready?" | `@reviewer` | 4, 6 |
| "Check security" | `@security` | 4 |
| "Deploy this" / "set up CI/CD" | `@deployer` | 5 |
| "Watch the repo" / "check PRs" | `@github-tracker` | 6 |
| "Monitor production" / "check logs" | `@ops-monitor` | 6 |
| "What's the project state?" | `@code` (direct) | All |
| "Run autonomously" | `@code` (auto-advance mode) | All |

---

## 3. Gate Protocol

Each gate blocks pipeline progress until the condition is met:

```
Gate: Brief Approved (Phase 0 → 1)
  Condition: User says "approved" or edits brief

Gate: Plan Approved (Phase 1 → 2)
  Condition: User approves feature scope

Gate: Architecture Approved (Phase 2 → 3)
  Condition: User approves architecture

Gate: All P0 Built + Tests Pass (Phase 3 → 4)
  Condition: All P0 features implemented, all tests green
  Auto-advance: YES (if user hasn't overridden)

Gate: QA Pass (Phase 4 → 5)
  Condition: 70%+ coverage, 0 high-severity issues
  Auto-advance: NO (always show report)

Gate: Production Healthy (Phase 5 → 6)
  Condition: Health checks pass, monitoring active
  Auto-advance: NO (always ask before production deploy)

Gate: (none — Phase 6 is continuous)
```

**Auto-advance permission:** If user says "run autonomously" or "@code auto", CODE proceeds through auto-advance gates without asking. User can revoke this at any time.

---

## 4. Skill-to-Agent Mapping

| Skill | Used By | When |
|-------|---------|------|
| `production-hardening` | `@reviewer`, `@security`, `@deployer` | All phases (master checklist) |
| `infra-networking` | `@deployer`, `@architect` | Phases 2, 5 |
| `container-orch` | `@deployer` | Phase 5 |
| `distributed-systems` | `@architect`, `@backend` | Phases 2, 3 |
| `resilience-patterns` | `@backend`, `@ops-monitor` | Phases 3, 6 |
| `db-scale` | `@backend`, `@architect` | Phases 2, 3 |
| `prod-ops` | `@deployer`, `@ops-monitor` | Phases 5, 6 |
| `scope-classifier` | `@planner` | Phase 0, 1 |
| `feature-prioritizer` | `@planner` | Phase 1 |
| `stack-selector` | `@architect` | Phase 2 |
| `modularity` | All build agents | Phase 3 |
| `testing` | `@tester` | Phase 4 |
| `security` | `@security` | Phase 4 |
| `deployment` | `@deployer` | Phase 5 |
| `monitoring` | `@deployer`, `@ops-monitor` | Phases 5, 6 |

---

## 5. Output Artifacts

Each phase produces a file that the next phase consumes:

| Phase | Produces | Format | Consumed by |
|-------|----------|--------|-------------|
| Auto-Detect | `profile.json` | JSON | All phases |
| Inception | `brief.md` | Markdown | Plan |
| Plan | `plan.md` | Markdown | Architecture |
| Architecture | `architecture.md` | Markdown | Build |
| Build | `src/` | Code | Quality |
| Quality | `qa-report.md` | Markdown | Deploy |
| Deploy | Deployment URLs + CI/CD | Config | Operate |
| Operate | Status reports | Text | (archive) |

---

## 6. MCP Connectors (Optional)

Agents can use MCP servers when available. No MCP? They use CLI/HTTP fallbacks.

| Agent | MCP Connectors (optional) | Fallback |
|-------|--------------------------|----------|
| `@deployer` | Vercel MCP, AWS MCP, Docker MCP | CLI (vercel, aws, docker) |
| `@github-tracker` | GitHub MCP | `gh` CLI |
| `@ops-monitor` | Sentry MCP, Datadog MCP, PagerDuty MCP | curl + manual check |
| `@tester` | Browser MCP (Playwright) | CLI (vitest, playwright) |

---

*This file is the source of truth. All agents, skills, and profiles should reference it.*
