#!/usr/bin/env node
/**
 * shipkit — Code Development OS
 * 14 agents, 7 production-hardening skills, cross-platform plugin
 */

import { program } from 'commander';
import { createProject } from '../lib/create-project.js';
import { listTemplates } from '../lib/create-project.js';
import { setupGlobal } from '../lib/setup-global.js';

program
  .name('shipkit')
  .description('Code Development OS — production-ready code from AI tools')
  .version('1.0.0');

program
  .command('create <project-name>')
  .description('Create a new project with CODE system')
  .option('-t, --type <type>', 'Project type: web, mobile, extension', 'web')
  .option('-s, --scope <scope>', 'Project scope')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip npm install')
  .action(async (name, options) => {
    await createProject(name, options);
  });

program
  .command('init')
  .description('Initialize CODE in existing project')
  .option('--global', 'Install globally for all projects')
  .action(async (options) => {
    if (options.global) {
      await setupGlobal();
    } else {
      console.log('Run in project directory to initialize locally');
    }
  });

program
  .command('templates')
  .description('List available project templates')
  .action(() => {
    listTemplates();
  });

program
  .command('agents')
  .description('List available agents')
  .action(() => {
    console.log(`
CODE Agents (14 total):

Orchestrator:
  code            - Master orchestrator, routes all requests

Phase -1 (Auto-Detect):
  auto-detect     - Classifies project type, loads appropriate skills

Phase 1 (Plan):
  planner         - Requirements gathering, scope classification

Phase 2 (Architect):
  architect       - Stack selection, project structure, data model

Phase 3 (Build):
  frontend        - UI components, state management
  backend         - APIs, databases, authentication
  mobile          - React Native/Expo mobile apps
  extension       - Chrome extensions (Manifest V3)

Phase 4 (Quality):
  tester          - Unit, integration, E2E, security tests
  security        - Security audit, OWASP, compliance
  reviewer        - Code review, handoff readiness

Phase 5 (Deploy):
  deployer        - CI/CD, infrastructure, monitoring

Phase 6 (Operate):
  github-tracker  - Watches PRs, issues, releases, CI
  ops-monitor     - Watches logs, metrics, uptime, alerts

Usage: Just ask CODE - it routes to the right agent automatically.
    `);
  });

program
  .command('skills')
  .description('List available skills')
  .action(() => {
    console.log(`
Production-Hardening Skills (7 - auto-loaded by profile):

  production-hardening  - Master checklist, coordinates all sub-skills
  infra-networking      - CDN, DNS, WAF, SSL, DDoS, multi-region
  container-orch        - Docker, Compose, Kubernetes, Helm, CI/CD
  db-scale              - Pooling, replicas, sharding, migrations
  resilience-patterns   - Rate limiting, circuit breakers, retries
  security-hardening    - OWASP Top 10, auth, encryption, compliance
  prod-ops              - Monitoring, SLOs, incident response, cost

Base Skills (15 - scaffolded into new projects):

Planning:
  scope-classifier      - Project type & scope classification
  feature-prioritizer   - P0/P1/P2/P3 feature classification
  stack-selector        - Tech stack selection

Development:
  modularity            - File naming, structure, size limits
  testing               - Test generation, coverage targets
  git-workflow          - Branches, commits, PRs

Quality:
  security              - Security checklist, best practices
  documentation         - README, API docs, architecture
  performance           - Optimization, bundle size, Lighthouse
  deployment            - Environments, CI/CD, rollback
  monitoring            - Logging, error tracking, alerts
  handoff               - 30-minute rule, readiness checklist
  cleanup               - Remove console.log, TODOs, dead code
  context-manager       - Project state across sessions
  confirmation          - Mandatory approval before actions

Skills auto-load when the relevant agent runs.
    `);
  });

program.parse();