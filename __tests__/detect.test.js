#!/usr/bin/env node
/**
 * Tests for lib/detect.js
 */
import { describe, it, expect } from '@jest/globals';
import { detectAgents, detectCurrentAgent, AGENTS } from '../lib/detect.js';

describe('detect.js — Agent Detection', () => {
  describe('AGENTS', () => {
    it('has 9 agent definitions', () => {
      const ids = Object.keys(AGENTS);
      expect(ids).toContain('opencode');
      expect(ids).toContain('claude-code');
      expect(ids).toContain('cursor');
      expect(ids).toContain('codex-cli');
      expect(ids).toContain('aider');
      expect(ids).toContain('windsurf');
      expect(ids).toContain('cline');
      expect(ids).toContain('gemini-cli');
      expect(ids).toContain('antigravity');
      expect(ids.length).toBe(9);
    });

    it('each agent has name, detect, pluginDir, installMethod, skillDir, agentDir', () => {
      for (const [id, agent] of Object.entries(AGENTS)) {
        expect(agent.name).toBeTruthy();
        expect(typeof agent.detect).toBe('function');
        expect(typeof agent.pluginDir).toBe('function');
        expect(typeof agent.skillDir).toBe('function');
        expect(typeof agent.agentDir).toBe('function');
        expect(['npm', 'plugin', 'symlink']).toContain(agent.installMethod);
        expect(agent.pluginDir()).toContain('.');
      }
    });

    it('each agent name matches its id', () => {
      expect(AGENTS.opencode.name).toBe('OpenCode');
      expect(AGENTS['claude-code'].name).toBe('Claude Code');
      expect(AGENTS['codex-cli'].name).toBe('Codex CLI');
      expect(AGENTS['gemini-cli'].name).toBe('Gemini CLI');
    });
  });

  describe('detectAgents()', () => {
    it('returns an array (may be empty if no agents present)', async () => {
      const agents = await detectAgents();
      expect(Array.isArray(agents)).toBe(true);
    });

    it('each result has the right shape', async () => {
      const agents = await detectAgents();
      for (const agent of agents) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('pluginDir');
        expect(agent).toHaveProperty('installMethod');
        expect(agent).toHaveProperty('skillDir');
        expect(agent).toHaveProperty('agentDir');
        expect(typeof agent.id).toBe('string');
        expect(typeof agent.name).toBe('string');
      }
    });
  });

  describe('detectCurrentAgent()', () => {
    it('returns null or an object', async () => {
      const agent = await detectCurrentAgent();
      if (agent) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
      } else {
        expect(agent).toBeNull();
      }
    });
  });
});
