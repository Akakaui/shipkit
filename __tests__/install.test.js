#!/usr/bin/env node
/**
 * Tests for lib/install.js
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { installIntoAgent, installLocal } from '../lib/install.js';
import { mkdtempSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir } from 'fs/promises';

describe('install.js — Cross-Platform Installer', () => {
  let tmpDir;
  let mockAgent;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'shipkit-install-'));
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      pluginDir: join(tmpDir, 'plugin'),
      skillDir: join(tmpDir, 'plugin', 'skills'),
      agentDir: join(tmpDir, 'plugin', 'agents'),
      installMethod: 'copy',
    };
  });

  describe('installIntoAgent()', () => {
    it('installs agents and skills into target directories', async () => {
      // We expect this to work with the real shipkit dir structure
      const result = await installIntoAgent(mockAgent);
      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('agents');
      expect(result).toHaveProperty('skills');
      expect(result.agent).toBe('Test Agent');
      expect(result.agents).toBeGreaterThan(0);
      expect(result.skills).toBeGreaterThan(0);
    });

    it('creates skill directory', async () => {
      await installIntoAgent(mockAgent);
      expect(existsSync(mockAgent.skillDir)).toBe(true);
    });

    it('creates agent directory', async () => {
      await installIntoAgent(mockAgent);
      expect(existsSync(mockAgent.agentDir)).toBe(true);
    });
  });

  describe('installLocal()', () => {
    it('creates .shipkit directory structure', async () => {
      await installLocal(tmpDir);
      expect(existsSync(join(tmpDir, '.shipkit'))).toBe(true);
      expect(existsSync(join(tmpDir, '.shipkit', 'agents'))).toBe(true);
      expect(existsSync(join(tmpDir, '.shipkit', 'skills'))).toBe(true);
      expect(existsSync(join(tmpDir, '.shipkit', 'shipkit.json'))).toBe(true);
    });

    it('copies skills and agents', async () => {
      await installLocal(tmpDir);
      const agentsDir = join(tmpDir, '.shipkit', 'agents');
      const skillsDir = join(tmpDir, '.shipkit', 'skills');
      const agentFiles = await import('fs').then(fs =>
        fs.promises.readdir(agentsDir)
      );
      const skillFiles = await import('fs').then(fs =>
        fs.promises.readdir(skillsDir)
      );
      expect(agentFiles.length).toBeGreaterThan(0);
      expect(skillFiles.length).toBeGreaterThan(0);
    });

    it('writes shipkit.json metadata', async () => {
      await installLocal(tmpDir);
      const { readFile } = await import('fs/promises');
      const meta = JSON.parse(await readFile(
        join(tmpDir, '.shipkit', 'shipkit.json'), 'utf-8'
      ));
      expect(meta.version).toBe('1.0.0');
      expect(meta.installedAt).toBeTruthy();
    });
  });
});
