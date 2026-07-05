#!/usr/bin/env node
/**
 * shipkit — Agent Detection
 *
 * Detects which AI coding agent is running and what plugin system it uses.
 * Supports: OpenCode, Claude Code, Cursor, Codex CLI, Aider, Windsurf, Cline, Gemini CLI, Antigravity
 *
 * @license MIT
 * @author Akakaui
 */

import { access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { env, platform, argv } from 'process';
import { readFile } from 'fs/promises';

const AGENTS = {
  opencode: {
    name: 'OpenCode',
    detect: async () => {
      // OpenCode sets env var or runs as opencode CLI
      if (env.OPENCODE_PLUGIN_DIR) return true;
      if (argv[1] && argv[1].includes('opencode')) return true;
      // Check for opencode config
      try {
        await access(join(homedir(), '.config', 'opencode', 'opencode.json'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.config', 'opencode'),
    installMethod: 'npm',
    skillDir: () => join(homedir(), '.config', 'opencode', 'skills'),
    agentDir: () => join(homedir(), '.config', 'opencode', 'agents'),
  },
  'claude-code': {
    name: 'Claude Code',
    detect: async () => {
      if (env.CLAUDE_CODE_PLUGIN_DIR) return true;
      if (argv[1] && argv[1].includes('claude')) return true;
      try {
        await access(join(homedir(), '.claude', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.claude', 'plugins'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.claude', 'plugins', 'skills'),
    agentDir: () => join(homedir(), '.claude', 'plugins', 'agents'),
  },
  cursor: {
    name: 'Cursor',
    detect: async () => {
      try {
        const configPath = join(homedir(), '.cursor', 'config.json');
        await access(configPath);
        const cfg = JSON.parse(await readFile(configPath, 'utf-8'));
        return !!(cfg.plugins || cfg.extensions);
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.cursor'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.cursor', 'skills'),
    agentDir: () => join(homedir(), '.cursor', 'agents'),
  },
  'codex-cli': {
    name: 'Codex CLI',
    detect: async () => {
      if (env.CODEX_CLI_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.codex', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.codex', 'plugins'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.codex', 'plugins', 'skills'),
    agentDir: () => join(homedir(), '.codex', 'plugins', 'agents'),
  },
  aider: {
    name: 'Aider',
    detect: async () => {
      if (argv[1] && argv[1].includes('aider')) return true;
      try {
        await access(join(homedir(), '.aider', 'skills'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.aider'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.aider', 'skills'),
    agentDir: () => join(homedir(), '.aider', 'agents'),
  },
  windsurf: {
    name: 'Windsurf',
    detect: async () => {
      try {
        await access(join(homedir(), '.windsurf', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.windsurf'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.windsurf', 'skills'),
    agentDir: () => join(homedir(), '.windsurf', 'agents'),
  },
  cline: {
    name: 'Cline',
    detect: async () => {
      if (env.CLINE_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.cline', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.cline', 'plugins'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.cline', 'plugins', 'skills'),
    agentDir: () => join(homedir(), '.cline', 'plugins', 'agents'),
  },
  'gemini-cli': {
    name: 'Gemini CLI',
    detect: async () => {
      if (env.GEMINI_CLI_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.gemini', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.gemini', 'plugins'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.gemini', 'plugins', 'skills'),
    agentDir: () => join(homedir(), '.gemini', 'plugins', 'agents'),
  },
  antigravity: {
    name: 'Antigravity',
    detect: async () => {
      if (env.ANTIGRAVITY_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.antigravity', 'plugins'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.antigravity', 'plugins'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.antigravity', 'plugins', 'skills'),
    agentDir: () => join(homedir(), '.antigravity', 'plugins', 'agents'),
  },
};

/**
 * Detect which coding agents are present on this machine.
 * @returns {Promise<Array<{id: string, name: string, pluginDir: string, installMethod: string}>>}
 */
export async function detectAgents() {
  const found = [];

  for (const [id, agent] of Object.entries(AGENTS)) {
    try {
      const isPresent = await agent.detect();
      if (isPresent) {
        found.push({
          id,
          name: agent.name,
          pluginDir: agent.pluginDir(),
          installMethod: agent.installMethod,
          skillDir: agent.skillDir(),
          agentDir: agent.agentDir(),
        });
      }
    } catch {
      // Detection failed silently — agent not present
    }
  }

  return found;
}

/**
 * Detect the CURRENTLY RUNNING agent (the one invoking shipkit).
 * @returns {Promise<{id: string, name: string} | null>}
 */
export async function detectCurrentAgent() {
  for (const [id, agent] of Object.entries(AGENTS)) {
    try {
      if (await agent.detect()) {
        return { id, name: agent.name };
      }
    } catch { /* skip */ }
  }
  return null;
}

export { AGENTS };
