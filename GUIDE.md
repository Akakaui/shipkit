# CODE - Complete User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [What is CODE?](#what-is-code)
3. [Quick Start](#quick-start)
4. [Project Types & Scopes](#project-types--scopes)
5. [Agents](#agents)
6. [Skills](#skills)
7. [Tools](#tools)
8. [Workflow Phases](#workflow-phases)
9. [Quality Standards](#quality-standards)
10. [Common Workflows](#common-workflows)
11. [Customization](#customization)

---

## Introduction

CODE is an AI Development Operating System that orchestrates specialized agents to build production-ready software. Rather than writing all code yourself, you work with a team of AI agents that handle different parts of the development lifecycle.

## What is CODE?

CODE provides:
- **11 specialized agents** for different development domains
- **15 reusable skills** loaded automatically by agents
- **5 automation tools** for common tasks
- **6 workflow phases** that ensure nothing is skipped
- **Quality gates** that prevent tech debt

The primary agent `@code` orchestrates the system. When you make a request, it routes to the right sub-agent based on intent and applies the right skills.

## Quick Start

\`\`\`bash
# Create a new project
npx @akakaui/shipkit@latest my-saas-app

# Navigate into it
cd my-saas-app

# Install dependencies
npm install

# Start development
npm run dev
\`\`\`

Then open your AI coding assistant and ask `@code` for help.

## Project Types & Scopes

CODE supports three project types. Each type has different scopes that determine which engineering layers are required.

### Web Applications

\`\`\`
Landing Page
└── Frontend only (HTML, CSS, JS)

Interactive Frontend
└── Frontend + State Management

Lightweight Web App
└── Frontend + Backend + Database

Full-Scale Web App
└── All 10 engineering areas
\`\`\`

### Mobile Apps (React Native)

\`\`\`
Single-screen
└── One screen, minimal interaction

Multi-screen
└── Multiple screens, small backend

Lightweight
└── Backend integration, moderate features

Full-Scale
└── Complete production app
\`\`\`

### Chrome Extensions

\`\`\`
Simple
└── Popup only, minimal background

Interactive
└── Popup + content scripts + API

Full-featured
└── Background + content + options + API + offline
\`\`\`

## Agents

### Primary Agent

**`@code`** - Main orchestrator
Routes all requests to sub-agents. You don't need to specify which agent to use - `@code` figures it out from context.

### Sub-Agents (Called Automatically)

| Agent | When It's Called | What It Does |
|-------|------------------|--------------|
| `@planner` | "Plan my project" | Requirements, scope, features, risks |
| `@architect` | "Build a [type] app" | Stack selection, project structure |
| `@frontend` | "Build the UI" | React components, state, styles |
| `@backend` | "Build the API" | Endpoints, database, auth |
| `@mobile` | "Build mobile app" | React Native/Expo implementation |
| `@extension` | "Build extension" | Chrome extension implementation |
| `@tester` | "Add tests" | Unit, integration, E2E tests |
| `@deployer` | "Deploy this" | CI/CD, multi-env deployment |
| `@reviewer` | "Review my code" | Quality gates, handoff check |
| `@security` | "Check security" | Security audit, hardening |

### How Sub-Agents Work

You never need to type `@planner` or `@frontend`. Just say what you want, and `@code` routes it:

\u003e's
   
   "Plan my SaaS dashboard"     → @planner activates
   
   "Build me a pricing page"    → @frontend activates
   
   "Add Stripe integration"     → @backend activates
   
   "Deploy to production"       → @deployer activates
   
   "Review for handoff"         → @reviewer activates

## Skills

Skills are reusable protocols that agents load automatically based on context.

### Planning Skills

- **scope-classifier** - Determines project type and scope
- **feature-prioritizer** - Classifies features as P0/P1/P2/P3
- **stack-selector** - Chooses appropriate tech stack

### Development Skills

- **modularity** - Enforces file naming, 250-line limit, feature-based organization
- **testing** - Test generation standards, coverage targets
- **git-workflow** - Branch strategy, conventional commits

### Quality Skills

- **security** - Security checklist, common pitfalls
- **documentation** - README templates, API docs
- **performance** - Bundle size, Lighthouse, optimization
- **deployment** - Environment setup, CI/CD patterns
- **monitoring** - Logging, error tracking, alerts
- **handoff** - 30-minute rule, readiness checklist

### Utility Skills

- **cleanup** - Remove console.log, TODOs, dead code
- **context-manager** - Maintain state across sessions
- **confirmation** - Mandatory approval before destructive actions

## Tools

### scaffolder.js

Creates project folder structure based on type and scope.

\`\`\`bash
node scaffolder.js ./my-project web lightweight
\`\`\`

### test-runner.js

Runs tests with coverage enforcement.

\`\`\`bash
node test-runner.js ./my-project all
node test-runner.js ./my-project coverage
node test-runner.js ./my-project watch
\`\`\`

### bundle-analyzer.js

Checks bundle size and Lighthouse scores.

\`\`\`bash
node bundle-analyzer.js ./my-project bundle
node bundle-analyzer.js ./my-project performance
\`\`\`

### deploy-pipeline.js

Sets up CI/CD and deploys to environments.

\`\`\`bash
node deploy-pipeline.js ./my-project setup
node deploy-pipeline.js ./my-project staging
node deploy-pipeline.js ./my-project production --force
\`\`\`

### handoff-validator.js

Runs the 30-minute handoff readiness test.

\`\`\`bash
node handoff-validator.js ./my-project
\`\`\`

## Workflow Phases

Every project follows 6 phases. CODE never skips phases.

### Phase 1: Planning

\`@planner\` gathers requirements and produces a planning summary.

**Inputs:** Your idea
**Outputs:** One-page planning document

### Phase 2: Architecture

\`@architect\` selects the stack and designs structure.

**Inputs:** Planning summary
**Outputs:** Technical blueprint

### Phase 3: Implementation

\`@frontend\` / \`@backend\` / \`@mobile\` / \`@extension\` builds the code.

**Inputs:** Technical blueprint
**Outputs:** Working source code

### Phase 4: Quality Assurance

\`@tester\` and \`@reviewer\` ensure quality.

**Inputs:** Source code
**Outputs:** Test suite, review report

### Phase 5: Documentation

All agents document their work.

**Inputs:** Everything so far
**Outputs:** README, API docs, architecture docs

### Phase 6: Handoff

\`@deployer\` deploys, \`@reviewer\` validates handoff.

**Inputs:** Production-ready code
**Outputs:** Deployed application, handoff documentation

## Quality Standards

CODE enforces these standards on every project:

### Code Quality
- TypeScript strict mode (no \`any\` types)
- Files under 250 lines
- Functions under 50 lines
- No console.log in production
- No TODO comments
- No duplicate code (DRY)
- All magic numbers extracted

### Testing
- 70%+ code coverage overall
- 90%+ for API endpoints
- 100% for critical paths
- Happy path + 3 error cases per feature

### Security
- All inputs validated (frontend AND backend)
- Environment variables for all secrets
- No secrets in code or Git
- HTTPS only
- Rate limiting on APIs
- Password hashing
- Prepared statements

### Performance
- Lighthouse score >90
- Bundle size <500KB (before splitting)
- Initial load <3 seconds
- Database queries indexed
- Caching strategy implemented

### Documentation
- README with setup instructions
- API endpoint documentation
- Architecture documentation
- Complex logic has comments
- All env vars documented
- Third-party services documented

## Common Workflows

### Workflow 1: New SaaS App

\`\`\`
You: "I want to build a SaaS dashboard for project management"

\u0040code:
1. @planner → Gathers requirements, classifies as Full-Scale Web App
2. @architect → Selects Next.js + PostgreSQL + Vercel
3. @frontend → Builds dashboard UI
4. @backend → Builds API, database, auth
5. @tester → Writes tests (P0 features first)
6. @reviewer → Runs quality gates
7. @deployer → Deploys to staging, then production
8. @reviewer → Validates handoff readiness
\`\`\`

### Workflow 2: Add New Feature

\`\`\`
You: "Add Stripe payment integration"

\u0040code:
1. @security → Reviews API integration approach
2. @backend → Implements Stripe webhook handler
3. @backend → Adds payment endpoints
4. @frontend → Adds pricing UI
5. @tester → Writes integration tests
6. @reviewer → Reviews for security issues
\`\`\`

### Workflow 3: Fix Bug

\`\`\`
You: "Login is broken"

\u0040code:
1. @tester → Reproduces with failing test
2. @backend → Diagnoses issue
3. @security → Reviews auth flow
4. @backend → Fixes bug
5. @tester → Verifies fix
6. @reviewer → Confirms no regressions
\`\`\`

### Workflow 4: Deploy to Production

\`\``
You: "Deploy to production"

\u0040code:
1. @deployer → Runs full test suite
2. @deployer → Builds for production
3. @security → Runs security scan
4. @reviewer → Final review
5. @deployer → Deploys via CI/CD
6. @deployer → Monitors for errors
\`\``

## Customization

### Adding Custom Agents

1. Create a new file in \`~/.config/opencode/agents/\`
2. Follow the agent format (mode, description, prompt)
3. Reference from \`@code\` routing table

### Adding Custom Skills

1. Create a new file in \`~/.config/opencode/skills/\`
2. Follow the skill format (markdown with purpose, triggers, rules)
3. Reference from relevant agent

### Project-Specific Configuration

Each project can have:
- \`AGENTS.md\` - Project-specific overrides
- \`.code/\` - Project-specific agents/skills/tools
- \`config/code.config.js\` - Codebase-specific settings

## Best Practices

### Do

- Always start with planning
- Always validate assumptions
- Always test before deploying
- Always document as you go
- Always run quality gates before handoff

### Don't

- Don't skip phases
- Don't overengineer for current scope
- Don't commit console.log or TODOs
- Don't deploy without tests
- Don't hand off incomplete projects

## Support
- Issues: https://github.com/Akakaui/shipkit/issues

- Docs: https://github.com/Akakaui/shipkit#readme
- Examples: See \`templates/\` directory

## License

MIT © Akakaui
