#!/usr/bin/env node
/**
 * Tests for lib/quality.js
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { runAllGates, estimateCoverage } from '../lib/quality.js';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('quality.js — Quality Gates', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'shipkit-quality-'));
  });

  describe('runAllGates()', () => {
    it('returns failing gates for empty project', async () => {
      const result = await runAllGates(tmpDir);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('checks');
      expect(Array.isArray(result.checks)).toBe(true);
      // Empty dir should fail some gates (missing package.json, readme, etc.)
      expect(result.checks.length).toBe(9);
    });

    it('passes all gates for a well-formed project', async () => {
      // Create src dir with clean files
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'index.js'),
        'export function add(a, b) { return a + b; }\n');
      // Create test directory
      mkdirSync(join(tmpDir, '__tests__'), { recursive: true });
      writeFileSync(join(tmpDir, '__tests__', 'test.js'), '// test\n');
      // Create package.json
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }));
      // Create README
      writeFileSync(join(tmpDir, 'README.md'), '# Test');
      // Create .gitignore
      writeFileSync(join(tmpDir, '.gitignore'), 'node_modules\n');
      // Create LICENSE
      writeFileSync(join(tmpDir, 'LICENSE'), 'MIT');

      const result = await runAllGates(tmpDir);
      expect(result.passed).toBe(true);
    });

    it('fails console.log gate when src has console.log', async () => {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'app.js'),
        'console.log("debug");\n');

      const result = await runAllGates(tmpDir);
      const consoleGate = result.checks.find(c => c.check === 'No console.log');
      expect(consoleGate).toBeDefined();
      expect(consoleGate.passed).toBe(false);
    });

    it('fails TODO gate when src has TODO', async () => {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'app.js'),
        '// TODO: fix this later\n');

      const result = await runAllGates(tmpDir);
      const todoGate = result.checks.find(c => c.check === 'No TODO/FIXME markers');
      expect(todoGate).toBeDefined();
      expect(todoGate.passed).toBe(false);
    });

    it('passes package.json gate when present', async () => {
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'x' }));

      const result = await runAllGates(tmpDir);
      const pkgGate = result.checks.find(c => c.check === 'Has package.json');
      expect(pkgGate).toBeDefined();
      expect(pkgGate.passed).toBe(true);
    });

    it('fails package.json gate when missing', async () => {
      const result = await runAllGates(tmpDir);
      const pkgGate = result.checks.find(c => c.check === 'Has package.json');
      expect(pkgGate).toBeDefined();
      expect(pkgGate.passed).toBe(false);
    });
  });

  describe('estimateCoverage()', () => {
    it('returns 100% when no source files exist', async () => {
      const result = await estimateCoverage(tmpDir);
      expect(result.coverage).toBe(100);
      expect(result.sourceFiles).toBe(0);
    });

    it('calculates test/source ratio', async () => {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'index.js'), '// source\n');
      writeFileSync(join(tmpDir, 'src', 'utils.js'), '// source\n');
      writeFileSync(join(tmpDir, 'src', 'utils.test.js'), '// test\n');

      const result = await estimateCoverage(tmpDir);
      expect(result.sourceFiles).toBe(2);
      expect(result.testFiles).toBe(1);
      expect(result.coverage).toBe(50); // 1/2 = 50%
    });

    it('handles .tsx and .jsx extensions', async () => {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'Component.tsx'), '// source\n');
      writeFileSync(join(tmpDir, 'src', 'Component.test.tsx'), '// test\n');

      const result = await estimateCoverage(tmpDir);
      expect(result.sourceFiles).toBe(1);
      expect(result.testFiles).toBe(1);
    });
  });
});
