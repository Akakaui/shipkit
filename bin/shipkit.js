#!/usr/bin/env node
/**
 * shipkit — Code Development OS
 *
 * Production-ready code from AI tools.
 * 14 agents, ~34 skills, 6-phase gated pipeline.
 * Cross-platform: OpenCode, Claude Code, Cursor, Codex CLI, Aider, Windsurf, Cline, Gemini CLI, Antigravity
 *
 * @license MIT
 * @author Akakaui
 */

import { program } from 'commander';
import { createProject, listTemplates } from '../lib/create-project.js';
import { setupGlobal } from '../lib/setup-global.js';
import { detectAgents, detectCurrentAgent } from '../lib/detect.js';
import { installIntoAgent, installIntoAllAgents, installLocal } from '../lib/install.js';
import { route, listAgents, PHASES } from '../lib/router.js';
import { Pipeline } from '../lib/pipeline.js';
import { runAllGates, estimateCoverage } from '../lib/quality.js';
import { convertAll, FORMATS } from '../lib/convert.js';
import chalk from 'chalk';

program
  .name('shipkit')
  .description('Code Development OS — production-ready code from AI coding agents')
  .version('1.0.0');

// ── create ──────────────────────────────────────────────────────────
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

// ── init ────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Install shipkit into AI coding agents (auto-detect + install)')
  .option('--local', 'Install in current project only (.shipkit/)')
  .option('--verbose', 'Show detailed install output')
  .action(async (options) => {
    if (options.local) {
      const localDir = await installLocal(process.cwd());
      console.log(chalk.green(`\n✅ shipkit installed locally at ${localDir}`));
      return;
    }

    console.log(chalk.cyan('\n🔍 Detecting AI coding agents...\n'));
    const agents = await detectAgents();

    if (agents.length === 0) {
      console.log(chalk.yellow('No supported AI coding agents detected.'));
      console.log(chalk.gray('Install one of: OpenCode, Claude Code, Cursor, Codex CLI, Aider, Windsurf, Cline, Gemini CLI, Antigravity'));
      console.log(chalk.gray('\nYou can also run:'));
      console.log(chalk.gray('  npx shipkit init --local    # Install in current project'));
      return;
    }

    console.log(`Found ${agents.length} agent(s):`);
    for (const agent of agents) {
      console.log(`  ${chalk.green('✓')} ${agent.name} (${agent.installMethod})`);
    }
    console.log();

    const results = await installIntoAllAgents(agents, { verbose: options.verbose });
    console.log(chalk.cyan('\n📋 Install summary:'));
    for (const r of results) {
      console.log(`  ${r.agent}: ${r.agents} agents, ${r.skills} skills`);
    }
    console.log(chalk.green('\n✅ shipkit is ready. Start your AI coding agent and ask @code what to do next.'));
  });

// ── detect ──────────────────────────────────────────────────────────
program
  .command('detect')
  .description('Detect AI coding agents on this machine')
  .action(async () => {
    console.log(chalk.cyan('\n🔍 Detecting AI coding agents...\n'));
    const agents = await detectAgents();
    const current = await detectCurrentAgent();

    if (agents.length === 0) {
      console.log(chalk.yellow('No supported AI coding agents detected.'));
      return;
    }

    for (const agent of agents) {
      const isCurrent = current && agent.id === current.id;
      const prefix = isCurrent ? chalk.green('▶') : ' ';
      const method = chalk.gray(`(${agent.installMethod})`);
      console.log(` ${prefix} ${agent.name} ${method}`);
      console.log(`     ${chalk.gray(agent.pluginDir)}`);
    }
    console.log();
  });

// ── route ───────────────────────────────────────────────────────────
program
  .command('route <request>')
  .description('Test route a request to see which agent handles it')
  .action((request) => {
    const result = route(request);
    console.log(chalk.cyan('\n🔄 Route result:\n'));
    if (result.agent) {
      console.log(`  Agent:      ${chalk.green('@' + result.agent)}`);
      console.log(`  Phase:      ${result.phase ? result.phase.name : 'N/A'}`);
      console.log(`  Confidence: ${result.confidence}%`);
      if (result.action) console.log(`  Action:     ${result.action}`);
    } else {
      console.log(chalk.yellow('  No matching agent found — using @code'));
    }
    console.log();
  });

// ── pipeline ────────────────────────────────────────────────────────
program
  .command('pipeline')
  .description('Show pipeline status or manage phases')
  .option('--status', 'Show current pipeline status')
  .option('--advance', 'Advance to next phase')
  .option('--skip-to <phase>', 'Skip to a specific phase (-1 to 6)')
  .option('--auto', 'Enable auto-advance mode')
  .option('--pause', 'Disable auto-advance mode')
  .action(async (options) => {
    const pipeline = await Pipeline.load(process.cwd());

    if (options.status) {
      console.log(chalk.cyan('\n📊 Pipeline Status:\n'));
      console.log(pipeline.getStatus());
      return;
    }

    if (options.auto) {
      pipeline.enableAutoAdvance();
      await pipeline.save();
      console.log(chalk.green('✅ Auto-advance enabled'));
      return;
    }

    if (options.pause) {
      pipeline.disableAutoAdvance();
      await pipeline.save();
      console.log(chalk.yellow('⏸  Auto-advance disabled'));
      return;
    }

    if (options.skipTo !== undefined) {
      pipeline.skipTo(parseInt(options.skipTo));
      await pipeline.save();
      const phase = pipeline.getCurrentPhase();
      console.log(chalk.green(`\n✅ Skipped to Phase ${phase.id}: ${phase.name}`));
      return;
    }

    if (options.advance) {
      const result = pipeline.advance();
      if (result.gate.canAdvance && result.phase) {
        await pipeline.save();
        console.log(chalk.green(`\n✅ Advanced to Phase ${result.phase.id}: ${result.phase.name}`));
      } else if (!result.phase) {
        console.log(chalk.green('\n✅ Pipeline complete! All phases done.'));
      } else {
        console.log(chalk.yellow(`\n⏸  ${result.gate.reason}`));
      }
      return;
    }

    // Default: show status
    console.log(chalk.cyan('\n📊 Pipeline Status:\n'));
    console.log(pipeline.getStatus());
  });

// ── quality ─────────────────────────────────────────────────────────
program
  .command('quality')
  .description('Run quality gates on the current project')
  .action(async () => {
    console.log(chalk.cyan('\n🔍 Running quality gates...\n'));

    const result = await runAllGates(process.cwd());
    const coverage = await estimateCoverage(process.cwd());

    for (const check of result.checks) {
      const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(` ${icon} ${check.check.padEnd(35)} ${chalk.gray(check.detail)}`);
    }

    console.log(`\n📈 Estimated coverage: ${coverage.coverage}% (${coverage.testFiles} test files / ${coverage.sourceFiles} source files)`);
    console.log(`\n${result.passed ? chalk.green('✅ All gates passed!') : chalk.red(`❌ ${result.reason}`)}`);
    console.log();
  });

// ── convert ─────────────────────────────────────────────────────────
program
  .command('convert')
  .description('Convert skills to another format')
  .option('-f, --format <format>', 'Target format: skm.md, md, json', 'md')
  .option('-o, --output <dir>', 'Output directory', './converted-skills')
  .action(async (options) => {
    console.log(chalk.cyan(`\n🔄 Converting skills to ${options.format}...\n`));

    if (!FORMATS[options.format]) {
      console.error(chalk.red(`Unknown format: ${options.format}`));
      console.log(chalk.gray(`Available: ${Object.keys(FORMATS).join(', ')}`));
      return;
    }

    const results = await convertAll(
      join(new URL('.', import.meta.url).pathname, '..', 'skills'),
      options.format,
      options.output
    );

    console.log(chalk.green(`Converted ${results.length} skills to ${options.output}/`));
    for (const r of results.slice(0, 10)) {
      console.log(`  ${chalk.gray(r)}`);
    }
    if (results.length > 10) console.log(`  ... and ${results.length - 10} more`);
    console.log();
  });

// ── agents ──────────────────────────────────────────────────────────
program
  .command('agents')
  .description('List available agents')
  .action(() => {
    const agents = listAgents();
    console.log(chalk.cyan('\n📋 CODE Agents (14 total):\n'));
    console.log('  Orchestrator:');
    console.log(`    ${'@code'.padEnd(20)}Master orchestrator — routes all requests`);
    console.log();
    console.log('  Phase -1 (Auto-Detect):');
    console.log(`    ${'@auto-detect'.padEnd(20)}Classifies project type, loads skills`);
    console.log();
    console.log('  Phase 0-1 (Plan):');
    console.log(`    ${'@planner'.padEnd(20)}Requirements, scope, features`);
    console.log();
    console.log('  Phase 2 (Architect):');
    console.log(`    ${'@architect'.padEnd(20)}Stack, data model, API design`);
    console.log();
    console.log('  Phase 3 (Build):');
    console.log(`    ${'@frontend'.padEnd(20)}UI components, state, routing`);
    console.log(`    ${'@backend'.padEnd(20)}APIs, databases, auth`);
    console.log(`    ${'@mobile'.padEnd(20)}React Native / Expo apps`);
    console.log(`    ${'@extension'.padEnd(20)}Chrome Manifest V3 extensions`);
    console.log();
    console.log('  Phase 4 (Quality):');
    console.log(`    ${'@tester'.padEnd(20)}Unit, integration, E2E tests`);
    console.log(`    ${'@security'.padEnd(20)}Vulnerability scanning, OWASP`);
    console.log(`    ${'@reviewer'.padEnd(20)}Code quality, handoff readiness`);
    console.log();
    console.log('  Phase 5 (Deploy):');
    console.log(`    ${'@deployer'.padEnd(20)}CI/CD, infra, monitoring`);
    console.log();
    console.log('  Phase 6 (Operate):');
    console.log(`    ${'@github-tracker'.padEnd(20)}PRs, issues, releases, CI`);
    console.log(`    ${'@ops-monitor'.padEnd(20)}Logs, metrics, uptime, alerts`);
    console.log(chalk.gray('\n  Usage: @code routes to the right agent automatically.'));
    console.log(chalk.gray('  Mention @agent to route directly.'));
    console.log();
  });

// ── skills ──────────────────────────────────────────────────────────
program
  .command('skills')
  .description('List available skills')
  .action(() => {
    console.log(chalk.cyan('\n📋 shipkit Skill Catalog (~34 skills):\n'));

    console.log(chalk.bold('  🔧 Core System   (created by @Akakaui)'));
    console.log('    bootstrap          Session initialization');
    console.log('    cleanup            End-of-session cleanup');
    console.log('    code-cleanup       Remove dead code, reduce technical debt');
    console.log('    confirmation       Mandatory approval before actions');
    console.log('    context-manager    Project state across sessions');
    console.log('    deployment         Environments, CI/CD, rollback');
    console.log('    distributed-systems Distributed system patterns');
    console.log('    document           Proposals, reports, structured content');
    console.log('    documentation      README, API docs, architecture');
    console.log('    feature-prioritizer P0/P1/P2/P3 feature classification');
    console.log('    git-workflow       Branches, commits, PRs');
    console.log('    handoff            30-minute rule, readiness checklist');
    console.log('    modularity         File naming, structure, size limits');
    console.log('    monitoring         Logging, error tracking, alerts');
    console.log('    performance        Optimization, bundle size, profiling');
    console.log('    scope-classifier   Project type & scope classification');
    console.log('    security           Security checklist, best practices');
    console.log('    skill-creator      Create new agent skill files');
    console.log('    skill-scanner      Discover available skills');
    console.log('    stack-selector     Tech stack selection');
    console.log('    testing            Test generation, coverage targets');
    console.log('    tools              Installed tools and system capabilities');
    console.log();

    console.log(chalk.bold('  🏗️ Production Hardening   (created by @Akakaui)'));
    console.log('    production-hardening  Master checklist for prod readiness');
    console.log('    infra-networking       CDN, DNS, WAF, SSL, multi-region');
    console.log('    container-orch          Docker, Compose, Kubernetes, Helm');
    console.log('    db-scale               Pooling, replicas, sharding, migrations');
    console.log('    resilience-patterns    Rate limiting, circuit breakers, retries');
    console.log('    security-hardening     OWASP Top 10, auth, encryption, compliance');
    console.log('    prod-ops               Monitoring, SLOs, incident response, cost');
    console.log();

    console.log(chalk.bold('  🎨 Frontend & UI   (sickn33, Apache 2.0)'));
    console.log('    frontend-design     Visual design guidance');
    console.log('    ui-ux-pro-max       UI/UX catalog reference');
    console.log('    canvas-design       PNG/PDF visual art creation');
    console.log();

    console.log(chalk.bold('  🔗 External Skills   (sickn33, Apache 2.0)'));
    console.log('    domain-router       Route to domain-specific knowledge');
    console.log('    doc-coauthoring     Co-author docs, proposals, specs');
    console.log();

    console.log(chalk.gray('  See README.md for full descriptions and author credits.'));
    console.log();
  });

// ── templates ───────────────────────────────────────────────────────
program
  .command('templates')
  .description('List available project templates')
  .action(() => {
    listTemplates();
  });

program.parse();
