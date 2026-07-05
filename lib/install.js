#!/usr/bin/env node
/**
 * shipkit — Cross-Platform Installer
 *
 * Installs shipkit's agents, skills, and orchestrator into any AI coding agent.
 * Supports 9 agents with different plugin systems.
 *
 * @license MIT
 * @author Akakaui
 */

import { mkdir, writeFile, copyFile, readdir, symlink } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SHIPKIT_DIR = resolve(__dirname, '..');

const REQUIRED_DIRS = ['agents', 'skills'];

/**
 * Install shipkit into a detected agent.
 * @param {object} agent - Agent object from detect.js
 * @param {object} options - { link?: boolean, verbose?: boolean }
 */
export async function installIntoAgent(agent, options = {}) {
  const spinner = ora(`Installing shipkit into ${agent.name}...`).start();

  try {
    // 1. Create target directories
    await mkdir(agent.skillDir, { recursive: true });
    await mkdir(agent.agentDir, { recursive: true });

    // 2. Copy or link agents
    const agentDir = join(SHIPKIT_DIR, 'agents');
    const agentDirs = await readdir(agentDir, { withFileTypes: true });
    let agentCount = 0;
    for (const entry of agentDirs) {
      if (!entry.isDirectory()) continue;
      const src = join(agentDir, entry.name, 'AGENT.md');
      const dest = join(agent.agentDir, `${entry.name}.md`);
      try {
        await copyFile(src, dest);
        agentCount++;
      } catch { /* skip missing */ }
    }
    spinner.text = `✓ ${agentCount} agents installed`;

    // 3. Copy or link skills
    const skillDir = join(SHIPKIT_DIR, 'skills');
    const skillDirs = await readdir(skillDir, { withFileTypes: true });
    let skillCount = 0;
    for (const entry of skillDirs) {
      if (!entry.isDirectory()) continue;
      const src = join(skillDir, entry.name, 'SKILL.md');
      const dest = join(agent.skillDir, `${entry.name}.skill.md`);
      try {
        await copyFile(src, dest);
        skillCount++;
      } catch { /* skip missing */ }
    }
    spinner.text = `✓ ${skillCount} skills installed`;

    // 4. Write agent manifest if applicable
    await writeAgentManifest(agent);

    spinner.succeed(chalk.green(`shipkit installed in ${agent.name}`));
    return { agent: agent.name, agents: agentCount, skills: skillCount };

  } catch (error) {
    spinner.fail(chalk.red(`Failed to install into ${agent.name}`));
    throw error;
  }
}

/**
 * Install shipkit into all detected agents.
 * @param {Array<object>} agents - Array from detectAgents()
 * @param {object} options
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
 * @param {string} projectPath
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

/**
 * Write an agent-specific manifest file.
 */
async function writeAgentManifest(agent) {
  switch (agent.id) {
    case 'opencode': {
      const manifestPath = join(agent.pluginDir, 'opencode.json');
      const manifest = {
        agents: agent.agentDir,
        skills: agent.skillDir,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      break;
    }
    case 'claude-code': {
      const manifestPath = join(agent.pluginDir, 'shipkit.json');
      await writeFile(manifestPath, JSON.stringify({
        name: 'shipkit',
        version: '1.0.0',
        description: 'Code Development OS — production-ready code from AI tools',
      }, null, 2));
      break;
    }
    case 'cursor': {
      const configPath = join(agent.pluginDir, 'config.json');
      // Append to existing or create
      let config = {};
      try {
        const raw = await readFile(configPath, 'utf-8').catch(() => '{}');
        config = JSON.parse(raw);
      } catch { config = {}; }
      config.shipkit = { agents: agent.agentDir, skills: agent.skillDir };
      await writeFile(configPath, JSON.stringify(config, null, 2));
      break;
    }
    // Other agents use standard file-based loading
  }
}

export default { installIntoAgent, installIntoAllAgents, installLocal };
