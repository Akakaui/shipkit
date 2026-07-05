#!/usr/bin/env node
/**
 * Tests for lib/convert.js
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { convertSkill, convertAll, FORMATS } from '../lib/convert.js';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, writeFile, readFile } from 'fs/promises';

const SAMPLE_SKILL = `---
name: test-skill
description: A test skill
triggers:
  - test
  - demo
metadata:
  author: test
---
# Test Skill

This is a test skill for unit tests.

## Usage

Run \`test\` to use this skill.
`;

describe('convert.js — Skill Format Converter', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'shipkit-convert-'));
    const skillsDir = join(tmpDir, 'skills', 'test-skill');
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, 'SKILL.md'), SAMPLE_SKILL);
  });

  describe('FORMATS', () => {
    it('has 3 formats', () => {
      expect(Object.keys(FORMATS).length).toBe(3);
    });

    it('includes skm.md, md, json', () => {
      expect(FORMATS['skm.md']).toBeDefined();
      expect(FORMATS['md']).toBeDefined();
      expect(FORMATS['json']).toBeDefined();
    });

    it('each format has name, extension, description', () => {
      for (const key of Object.keys(FORMATS)) {
        const fmt = FORMATS[key];
        expect(fmt).toHaveProperty('name');
        expect(fmt).toHaveProperty('extension');
        expect(fmt).toHaveProperty('description');
      }
    });
  });

  describe('convertSkill()', () => {
    it('converts to skm.md format (copies)', async () => {
      const skillPath = join(tmpDir, 'skills', 'test-skill', 'SKILL.md');
      const outDir = join(tmpDir, 'out');
      const result = await convertSkill(skillPath, 'skm.md', outDir);
      expect(result).toContain('test-skill.skill.md');

      const content = await readFile(result, 'utf-8');
      expect(content).toContain('Test Skill');
    });

    it('converts to plain md (strips frontmatter)', async () => {
      const skillPath = join(tmpDir, 'skills', 'test-skill', 'SKILL.md');
      const outDir = join(tmpDir, 'out');
      const result = await convertSkill(skillPath, 'md', outDir);
      expect(result).toContain('test-skill.md');

      const content = await readFile(result, 'utf-8');
      expect(content).not.toContain('---');
      expect(content).toContain('Test Skill');
    });

    it('converts to json (structured)', async () => {
      const skillPath = join(tmpDir, 'skills', 'test-skill', 'SKILL.md');
      const outDir = join(tmpDir, 'out');
      const result = await convertSkill(skillPath, 'json', outDir);
      expect(result).toContain('test-skill.json');

      const content = await readFile(result, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('test-skill');
      expect(parsed.body).toContain('Test Skill');
    });

    it('throws for unknown format', async () => {
      const skillPath = join(tmpDir, 'skills', 'test-skill', 'SKILL.md');
      await expect(convertSkill(skillPath, 'unknown', tmpDir)).rejects.toThrow();
    });
  });

  describe('convertAll()', () => {
    it('converts all skills in a directory', async () => {
      const outDir = join(tmpDir, 'out');
      const results = await convertAll(join(tmpDir, 'skills'), 'md', outDir);
      expect(results.length).toBe(1);
      expect(results[0]).toContain('.md');
    });
  });
});
