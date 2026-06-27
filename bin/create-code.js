#!/usr/bin/env node
/**
 * create-code - AI Development Operating System
 * Scaffolds complete projects with agents, skills, and tools
 */

import { program } from 'commander';
import { createProject } from '../lib/create-project.js';
import { listTemplates } from '../lib/create-project.js';
import { setupGlobal } from '../lib/setup-global.js';

program
  .name('create-code')
  .description('AI Development Operating System - scaffold complete projects')
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
CODE Agents (11 total):

Primary:
  code        - Main orchestrator, routes all requests

Sub-agents (called autonomously by code):
  planner     - Requirements gathering, scope classification
  architect   - Stack selection, project structure
  frontend    - UI components, state management
  backend     - APIs, databases, authentication
  mobile      - React Native/Expo apps
  extension   - Chrome extensions (Manifest V3)
  tester      - Unit, integration, E2E tests
  deployer    - CI/CD, deployment, monitoring
  reviewer    - Code review, handoff readiness
  security    - Security audit, compliance

Usage: Just ask CODE - it routes to the right agent automatically.
    `);
  });

program
  .command('skills')
  .description('List available skills')
  .action(() => {
    console.log(`
CODE Skills (14 total):

Planning:
  scope-classifier    - Project type & scope classification
  feature-prioritizer - P0/P1/P2/P3 feature classification
  stack-selector      - Tech stack selection

Development:
  modularity          - File naming, structure, size limits
  testing             - Test generation, coverage targets
  git-workflow        - Branches, commits, PRs

Quality:
  security            - Security checklist, best practices
  documentation       - README, API docs, architecture
  performance         - Optimization, bundle size, Lighthouse
  deployment          - Environments, CI/CD, rollback
  monitoring          - Logging, error tracking, alerts
  handoff             - 30-minute rule, readiness checklist
  cleanup             - Remove console.log, TODOs, dead code
  context-manager     - Project state across sessions
  confirmation        - Mandatory approval before actions

Each skill loads automatically when the relevant agent runs.
    `);
  });

program.parse();