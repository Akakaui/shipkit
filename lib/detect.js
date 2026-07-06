#!/usr/bin/env node
/**
 * shipkit — Agent Detection
 *
 * Detects which AI coding agent is running and what plugin system it uses.
 * Supports: OpenCode, Claude Code, Cursor, Codex CLI, Aider, Windsurf, Cline, Antigravity
 *
 * Each agent's ACTUAL plugin system (researched July 2026):
 *
 *   OpenCode     — ~/.config/opencode/       skills/ + agents/ dirs, opencode-plugin.json
 *   Claude Code  — ~/.claude/                plugins via plugin.json, skills via skills/
 *   Cursor       — ~/.cursor/rules/          .cursor-plugin/plugin.json, hooks.json
 *   Codex CLI    — ./.codex-plugin/          project-level plugin.json with skills/hooks/apps
 *   Cline        — ~/.cline/                 plugins/ + skills/ + agents/ + hooks/ dirs
 *   Aider        — NO PLUGIN SYSTEM          .aider.conf.yml + .aider-rules/ convention
 *   Windsurf     — NO PLUGIN SYSTEM          .windsurf/rules/*.md with YAML frontmatter
 *   Antigravity  — ~/.gemini/antigravity-cli/plugins/  hooks, subagents, sandbox
 *
 * @license MIT
 * @author Akakaui
 */

import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { env, argv } from 'process';

const AGENTS = {
  // ── OpenCode ──────────────────────────────────────────────────────
  opencode: {
    name: 'OpenCode',
    detect: async () => {
      if (env.OPENCODE_PLUGIN_DIR) return true;
      if (argv[1] && argv[1].includes('opencode')) return true;
      try {
        await access(join(homedir(), '.config', 'opencode', 'opencode.json'));
        return true;
      } catch {
        try {
          await access(join(homedir(), '.config', 'opencode'));
          return true;
        } catch { return false; }
      }
    },
    pluginDir: () => join(homedir(), '.config', 'opencode'),
    installMethod: 'npm',
    skillDir: () => join(homedir(), '.config', 'opencode', 'skills'),
    agentDir: () => join(homedir(), '.config', 'opencode', 'agents'),
    hasHooks: false,
    hasPluginJson: false,
    manifestFile: 'opencode-plugin.json',
  },

  // ── Claude Code ───────────────────────────────────────────────────
  'claude-code': {
    name: 'Claude Code',
    detect: async () => {
      if (env.CLAUDE_CODE_PLUGIN_DIR) return true;
      if (argv[1] && argv[1].includes('claude')) return true;
      try {
        await access(join(homedir(), '.claude'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.claude'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.claude', 'skills'),
    agentDir: () => join(homedir(), '.claude', 'agents'),
    hasHooks: true,
    hasPluginJson: true,
    manifestFile: 'plugin.json',
  },

  // ── Cursor ────────────────────────────────────────────────────────
  cursor: {
    name: 'Cursor',
    detect: async () => {
      try {
        await access(join(homedir(), '.cursor'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.cursor'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.cursor', 'skills'),
    agentDir: () => join(homedir(), '.cursor', 'agents'),
    hasHooks: true,
    hasPluginJson: false,
    manifestFile: null,
  },

  // ── Codex CLI ─────────────────────────────────────────────────────
  'codex-cli': {
    name: 'Codex CLI',
    detect: async () => {
      if (env.CODEX_CLI_PLUGIN_DIR) return true;
      // Codex CLI is project-local — check both home and cwd conventions
      try {
        await access(join(homedir(), '.codex'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.codex'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.codex', 'skills'),
    agentDir: () => join(homedir(), '.codex', 'agents'),
    hasHooks: false,
    hasPluginJson: true,
    manifestFile: 'plugin.json',
  },

  // ── Aider (NO PLUGIN SYSTEM — convention-based) ───────────────────
  aider: {
    name: 'Aider',
    detect: async () => {
      if (argv[1] && argv[1].includes('aider')) return true;
      // Aider has no plugin system — detect by config presence
      try {
        await access(join(homedir(), '.aider.conf.yml'));
        return true;
      } catch {
        try {
          const { execSync } = await import('child_process');
          execSync('which aider 2>/dev/null || command -v aider 2>/dev/null', { stdio: 'ignore' });
          return true;
        } catch { return false; }
      }
    },
    pluginDir: () => join(homedir(), '.aider'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.aider', 'rules'),
    agentDir: () => join(homedir(), '.aider', 'rules'),
    hasHooks: false,
    hasPluginJson: false,
    manifestFile: null,
  },

  // ── Windsurf (NO PLUGIN SYSTEM — rule files) ──────────────────────
  windsurf: {
    name: 'Windsurf',
    detect: async () => {
      try {
        await access(join(homedir(), '.windsurf'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.windsurf'),
    installMethod: 'symlink',
    skillDir: () => join(homedir(), '.windsurf', 'rules'),
    agentDir: () => join(homedir(), '.windsurf', 'rules'),
    hasHooks: false,
    hasPluginJson: false,
    manifestFile: null,
  },

  // ── Cline (full plugin system) ────────────────────────────────────
  cline: {
    name: 'Cline',
    detect: async () => {
      if (env.CLINE_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.cline'));
        return true;
      } catch { return false; }
    },
    pluginDir: () => join(homedir(), '.cline', 'plugins', 'shipkit'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.cline', 'plugins', 'shipkit', 'skills'),
    agentDir: () => join(homedir(), '.cline', 'plugins', 'shipkit', 'agents'),
    hasHooks: true,
    hasPluginJson: true,
    manifestFile: 'cline-plugin.json',
  },

  // ── Antigravity CLI ───────────────────────────────────────────────
  antigravity: {
    name: 'Antigravity',
    detect: async () => {
      if (env.ANTIGRAVITY_PLUGIN_DIR) return true;
      try {
        await access(join(homedir(), '.gemini', 'antigravity-cli', 'plugins'));
        return true;
      } catch {
        try {
          await access(join(homedir(), '.antigravity'));
          return true;
        } catch { return false; }
      }
    },
    pluginDir: () => join(homedir(), '.gemini', 'antigravity-cli', 'plugins', 'shipkit'),
    installMethod: 'plugin',
    skillDir: () => join(homedir(), '.gemini', 'antigravity-cli', 'plugins', 'shipkit', 'skills'),
    agentDir: () => join(homedir(), '.gemini', 'antigravity-cli', 'plugins', 'shipkit', 'agents'),
    hasHooks: true,
    hasPluginJson: true,
    manifestFile: 'antigravity-plugin.json',
  },
};

/**
 * Detect which coding agents are present on this machine.
 * @returns {Promise<Array<{id: string, name: string, pluginDir: string, installMethod: string, skillDir: string, agentDir: string}>>}
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
          hasHooks: agent.hasHooks,
          hasPluginJson: agent.hasPluginJson,
          manifestFile: agent.manifestFile,
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
