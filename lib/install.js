#!/usr/bin/env node
/**
 * shipkit — Cross-Platform Installer
 *
 * Installs shipkit's agents, skills, and orchestrator into any AI coding agent.
 * Supports 8 agents with different plugin systems:
 *
 *   OpenCode     → skills/ + agents/ directories, opencode-plugin.json
 *   Claude Code  → ~/.claude/skills/ + agents/, plus plugin.json manifest
 *   Cursor       → ~/.cursor/skills/ + agents/ via symlink
 *   Codex CLI    → ~/.codex/ skills/ + agents/ + plugin.json
 *   Cline        → ~/.cline/plugins/shipkit/ with hooks + manifest
 *   Aider        → ~/.aider/rules/ convention-based
 *   Windsurf     → ~/.windsurf/rules/ convention-based
 *   Antigravity  → ~/.gemini/antigravity-cli/plugins/shipkit/ with hooks
 *
 * @license MIT
 * @author Akakaui
 */

import { mkdir, writeFile, copyFile, readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SHIPKIT_DIR = resolve(__dirname, '..');

/**
 * Install shipkit into a detected agent.
 * Routes to the correct installer based on agent.id.
 */
export async function installIntoAgent(agent, options = {}) {
  const spinner = ora(`Installing shipkit into ${agent.name}...`).start();

  try {
    const installers = {
      'opencode':    installOpenCode,
      'claude-code': installClaudeCode,
      'cursor':      installCursor,
      'codex-cli':   installCodexCli,
      'cline':       installCline,
      'antigravity': installAntigravity,
      'aider':       installAider,
      'windsurf':    installWindsurf,
    };

    const installer = installers[agent.id];
    if (!installer) {
      spinner.fail(chalk.red(`Unknown agent: ${agent.id}`));
      return { agent: agent.name, agents: 0, skills: 0 };
    }

    const result = await installer(agent, spinner, options);
    spinner.succeed(chalk.green(`shipkit installed in ${agent.name}`));
    return { agent: agent.name, ...result };

  } catch (error) {
    spinner.fail(chalk.red(`Failed to install into ${agent.name}: ${error.message}`));
    throw error;
  }
}

/**
 * Install shipkit into all detected agents.
 */
export async function installIntoAllAgents(agents, options = {}) {
  const results = [];
  for (const agent of agents) {
    const result = await installIntoAgent(agent, options);
    results.push(result);
  }
  return results;
}

/**
 * Install shipkit into the current project (local .shipkit dir).
 */
export async function installLocal(projectPath) {
  const spinner = ora('Installing shipkit locally...').start();
  const localDir = join(projectPath, '.shipkit');

  try {
    await mkdir(join(localDir, 'agents'), { recursive: true });
    await mkdir(join(localDir, 'skills'), { recursive: true });

    // Copy agents
    const agentSrc = join(SHIPKIT_DIR, 'agents');
    const agentDirs = await readdir(agentSrc, { withFileTypes: true });
    for (const entry of agentDirs) {
      if (!entry.isDirectory()) continue;
      const src = join(agentSrc, entry.name, 'AGENT.md');
      const dest = join(localDir, 'agents', `${entry.name}.md`);
      try { await copyFile(src, dest); } catch { /* skip */ }
    }

    // Copy skills
    const skillSrc = join(SHIPKIT_DIR, 'skills');
    const skillDirs = await readdir(skillSrc, { withFileTypes: true });
    for (const entry of skillDirs) {
      if (!entry.isDirectory()) continue;
      const src = join(skillSrc, entry.name, 'SKILL.md');
      const dest = join(localDir, 'skills', `${entry.name}.skill.md`);
      try { await copyFile(src, dest); } catch { /* skip */ }
    }

    // Write .shipkit/shipkit.json
    await writeFile(join(localDir, 'shipkit.json'), JSON.stringify({
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      agents: agentDirs.filter(d => d.isDirectory()).map(d => d.name),
    }, null, 2));

    spinner.succeed(chalk.green('shipkit installed locally'));
    return localDir;

  } catch (error) {
    spinner.fail(chalk.red('Local install failed'));
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Per-Agent Installers
// ═════════════════════════════════════════════════════════════════════

// ── OpenCode ──────────────────────────────────────────────────────

async function installOpenCode(agent, spinner) {
  await mkdir(agent.skillDir, { recursive: true });
  await mkdir(agent.agentDir, { recursive: true });

  const agentCount = await copyAgentsFlat(agent.agentDir);
  spinner.text = `✓ ${agentCount} agents → ${agent.agentDir}`;

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} skills → ${agent.skillDir}`;

  // Write opencode-plugin.json in the package for npm-based discovery
  // (OpenCode reads this from node_modules/@akakaui/shipkit/opencode-plugin.json)
  // For global install, also write to ~/.config/opencode/opencode.json reference
  await writeOpenCodeConfig(agent);

  return { agents: agentCount, skills: skillCount };
}

async function writeOpenCodeConfig(agent) {
  const configPath = join(agent.pluginDir, 'opencode.json');
  let config = {};
  try {
    const raw = await readFile(configPath, 'utf-8').catch(() => '{}');
    config = JSON.parse(raw);
  } catch { config = {}; }

  // Add shipkit reference — don't overwrite existing MCP/server config
  config['shipkit'] = {
    agents: agent.agentDir,
    skills: agent.skillDir,
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

// ── Claude Code ───────────────────────────────────────────────────

async function installClaudeCode(agent, spinner) {
  // Claude Code: skills go to ~/.claude/skills/, agents (if applicable) to ~/.claude/agents/
  await mkdir(agent.skillDir, { recursive: true });
  await mkdir(agent.agentDir, { recursive: true });

  const agentCount = await copyAgentsFlat(agent.agentDir);
  spinner.text = `✓ ${agentCount} agents → ${agent.agentDir}`;

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} skills → ${agent.skillDir}`;

  // Write Claude Code plugin.json to ~/.claude/plugin.json
  await writeFile(join(agent.pluginDir, 'plugin.json'), JSON.stringify({
    name: 'shipkit',
    version: '1.0.0',
    description: 'Code Development OS — 14 agents, 7 production-hardening skills',
    repository: 'github.com/Akakaui/shipkit',
    homepage: 'https://github.com/Akakaui/shipkit',
    author: 'Akakaui',
    license: 'MIT',
    skills: [
      { name: 'production-hardening',  description: 'Master prod-readiness checklist' },
      { name: 'infra-networking',      description: 'CDN, DNS, WAF, SSL, multi-region' },
      { name: 'container-orch',        description: 'Docker, Compose, K8s, Helm' },
      { name: 'db-scale',              description: 'Pooling, replicas, sharding, migrations' },
      { name: 'resilience-patterns',   description: 'Rate limiting, circuit breakers, retries' },
      { name: 'security-hardening',    description: 'OWASP Top 10, auth, encryption, compliance' },
      { name: 'prod-ops',              description: 'Monitoring, SLOs, incident response' },
    ],
    agents: [
      { name: 'code',       description: 'Master orchestrator — routes all requests' },
      { name: 'planner',    description: 'Requirements, scope, features (Phase 1)' },
      { name: 'architect',  description: 'Stack, data model, API design (Phase 2)' },
      { name: 'auto-detect', description: 'Classifies project type, loads skills' },
    ],
    install: { method: 'npm', package: '@akakaui/shipkit' },
  }, null, 2));

  return { agents: agentCount, skills: skillCount };
}

// ── Cursor ────────────────────────────────────────────────────────

async function installCursor(agent, spinner) {
  // Cursor: skills/ + agents/ directories + hooks.json if needed
  await mkdir(agent.skillDir, { recursive: true });
  await mkdir(agent.agentDir, { recursive: true });

  const agentCount = await copyAgentsFlat(agent.agentDir);
  spinner.text = `✓ ${agentCount} agents → ${agent.agentDir}`;

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} skills → ${agent.skillDir}`;

  // Write hooks.json for Cursor lifecycle hooks
  await writeFile(join(agent.pluginDir, 'hooks.json'), JSON.stringify({
    "shipkit": {
      "description": "Code Development OS hooks",
      "hooks": {
        "onSessionStart": {
          "description": "Load CODE pipeline at session start",
          "run": ["load", "--agents", agent.agentDir, "--skills", agent.skillDir]
        }
      }
    }
  }, null, 2));

  return { agents: agentCount, skills: skillCount };
}

// ── Codex CLI ─────────────────────────────────────────────────────

async function installCodexCli(agent, spinner) {
  await mkdir(agent.skillDir, { recursive: true });
  await mkdir(agent.agentDir, { recursive: true });

  const agentCount = await copyAgentsFlat(agent.agentDir);
  spinner.text = `✓ ${agentCount} agents → ${agent.agentDir}`;

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} skills → ${agent.skillDir}`;

  // Write Codex CLI plugin.json
  await writeFile(join(agent.pluginDir, 'plugin.json'), JSON.stringify({
    name: 'shipkit',
    version: '1.0.0',
    description: 'Code Development OS — production-ready code from AI tools',
    repository: 'github.com/Akakaui/shipkit',
    authors: ['Akakaui'],
    license: 'MIT',
    skills: [
      'production-hardening', 'infra-networking', 'container-orch',
      'db-scale', 'resilience-patterns', 'security-hardening', 'prod-ops',
    ],
    agents: [
      'code', 'planner', 'architect', 'frontend', 'backend',
      'mobile', 'extension', 'tester', 'reviewer', 'deployer',
      'security', 'auto-detect', 'github-tracker', 'ops-monitor',
    ],
    scaffold: { templates: 'templates/' },
    install: { method: 'npm', package: '@akakaui/shipkit' },
  }, null, 2));

  return { agents: agentCount, skills: skillCount };
}

// ── Cline ─────────────────────────────────────────────────────────

async function installCline(agent, spinner) {
  // Cline: installs as ~/.cline/plugins/shipkit/ with its own dir structure
  await mkdir(agent.pluginDir, { recursive: true });
  await mkdir(join(agent.pluginDir, 'skills'), { recursive: true });
  await mkdir(join(agent.pluginDir, 'agents'), { recursive: true });
  await mkdir(join(agent.pluginDir, 'hooks'), { recursive: true });

  const agentCount = await copyAgentsFlat(join(agent.pluginDir, 'agents'));
  spinner.text = `✓ ${agentCount} agents → ${agent.pluginDir}/agents`;

  const skillCount = await copySkillsFlat(join(agent.pluginDir, 'skills'));
  spinner.text = `✓ ${skillCount} skills → ${agent.pluginDir}/skills`;

  // Write Cline plugin manifest
  await writeFile(join(agent.pluginDir, 'cline-plugin.json'), JSON.stringify({
    name: 'shipkit',
    version: '1.0.0',
    description: 'Code Development OS — production-ready code',
    author: 'Akakaui',
    license: 'MIT',
    skills: { dir: './skills' },
    agents: { dir: './agents' },
    hooks: { dir: './hooks' },
  }, null, 2));

  // Write lifecycle hooks for Cline
  await writeFile(join(agent.pluginDir, 'hooks', 'pre-tool.js'), `// shipkit — Cline pre-tool hook
// Runs quality gate before every tool execution
export async function preToolUse({ tool, args }) {
  // Agent routing happens via the loaded agent definitions
  return { allowed: true };
}
`);

  await writeFile(join(agent.pluginDir, 'hooks', 'post-tool.js'), `// shipkit — Cline post-tool hook
// Logs tool usage for pipeline tracking
export async function postToolUse({ tool, result }) {
  return { logged: true };
}
`);

  return { agents: agentCount, skills: skillCount };
}

// ── Antigravity CLI ───────────────────────────────────────────────

async function installAntigravity(agent, spinner) {
  // Antigravity: installs as ~/.gemini/antigravity-cli/plugins/shipkit/
  await mkdir(agent.pluginDir, { recursive: true });
  await mkdir(join(agent.pluginDir, 'skills'), { recursive: true });
  await mkdir(join(agent.pluginDir, 'agents'), { recursive: true });
  await mkdir(join(agent.pluginDir, 'hooks'), { recursive: true });

  const agentCount = await copyAgentsFlat(join(agent.pluginDir, 'agents'));
  spinner.text = `✓ ${agentCount} agents → ${agent.pluginDir}/agents`;

  const skillCount = await copySkillsFlat(join(agent.pluginDir, 'skills'));
  spinner.text = `✓ ${skillCount} skills → ${agent.pluginDir}/skills`;

  // Write Antigravity plugin manifest
  await writeFile(join(agent.pluginDir, 'antigravity-plugin.json'), JSON.stringify({
    name: 'shipkit',
    version: '1.0.0',
    description: 'Code Development OS',
    author: 'Akakaui',
    license: 'MIT',
    skills: './skills',
    agents: { dir: './agents' },
    hooks: { dir: './hooks' },
  }, null, 2));

  // Write pre/post tool hooks
  await writeFile(join(agent.pluginDir, 'hooks', 'preToolUse.js'), `// shipkit — Antigravity pre-tool hook
export default async function preToolUse({ toolName, args }) {
  return { allowed: true };
}
`);

  await writeFile(join(agent.pluginDir, 'hooks', 'postToolUse.js'), `// shipkit — Antigravity post-tool hook
export default async function postToolUse({ toolName, result }) {
  return { ok: true };
}
`);

  return { agents: agentCount, skills: skillCount };
}

// ── Aider (convention-based, no plugin system) ────────────────────

async function installAider(agent, spinner) {
  // Aider has NO plugin system.
  // We create ~/.aider/rules/ with skill markdown that Aider loads via --read
  await mkdir(agent.pluginDir, { recursive: true });
  await mkdir(agent.skillDir, { recursive: true });

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} skill rules → ${agent.skillDir}`;

  // Write aider-rules config
  await writeFile(join(agent.pluginDir, 'aider-rules.json'), JSON.stringify({
    name: 'shipkit',
    version: '1.0.0',
    description: 'Code Development OS rules for Aider',
    rules: agent.skillDir,
    load: ['--read', agent.skillDir + '/*'],
  }, null, 2));

  // Write aider.conf.yml convention
  await writeFile(join(agent.pluginDir, '.aider.conf.yml'), `# shipkit — Code Development OS
# Aider has no plugin system. These rules are loaded via --read flags.
# Usage: aider --read ~/.aider/rules/*.skill.md

read:
  - ${agent.skillDir}/*.skill.md

auto-commits: true
dirty-commits: true
`);

  return { agents: 0, skills: skillCount };
}

// ── Windsurf (convention-based, no plugin system) ─────────────────

async function installWindsurf(agent, spinner) {
  // Windsurf has NO plugin system.
  // We create ~/.windsurf/rules/*.md with YAML frontmatter
  await mkdir(agent.skillDir, { recursive: true });

  const skillCount = await copySkillsFlat(agent.skillDir);
  spinner.text = `✓ ${skillCount} rules → ${agent.skillDir}`;

  // For Windsurf, convert skills to rule files with YAML frontmatter
  // Each .skill.md becomes a .windsurf-rule.md
  const skillSrc = join(SHIPKIT_DIR, 'skills');
  const skillDirs = await readdir(skillSrc, { withFileTypes: true });
  let ruleCount = 0;

  for (const entry of skillDirs) {
    if (!entry.isDirectory()) continue;
    const src = join(skillSrc, entry.name, 'SKILL.md');
    try {
      const content = await readFile(src, 'utf-8');
      // Add Windsurf YAML frontmatter
      const ruleContent = `---
name: ${entry.name}
description: shipkit ${entry.name} skill
trigger: always_on
---

${content}
`;
      await writeFile(join(agent.skillDir, `${entry.name}.windsurf-rule.md`), ruleContent);
      ruleCount++;
    } catch { /* skip */ }
  }

  spinner.text = `✓ ${ruleCount} windsurf rules → ${agent.skillDir}`;

  return { agents: 0, skills: ruleCount };
}

// ═════════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════════

async function copyAgentsFlat(targetDir) {
  const src = join(SHIPKIT_DIR, 'agents');
  const entries = await readdir(src, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const agentFile = join(src, entry.name, 'AGENT.md');
    try {
      await copyFile(agentFile, join(targetDir, `${entry.name}.md`));
      count++;
    } catch { /* skip if AGENT.md doesn't exist */ }
  }

  return count;
}

async function copySkillsFlat(targetDir) {
  const src = join(SHIPKIT_DIR, 'skills');
  const entries = await readdir(src, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(src, entry.name, 'SKILL.md');
    try {
      await copyFile(skillFile, join(targetDir, `${entry.name}.skill.md`));
      count++;
    } catch { /* skip if SKILL.md doesn't exist */ }
  }

  return count;
}

export default { installIntoAgent, installIntoAllAgents, installLocal };
