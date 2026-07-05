#!/usr/bin/env node
/**
 * Integration tests for bin/shipkit.js CLI
 */
import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import { join } from 'path';

const BIN = join(process.cwd(), 'bin', 'shipkit.js');

describe('shipkit CLI', () => {
  it('--help prints usage', () => {
    const output = execSync(`node ${BIN} --help`, { encoding: 'utf-8' });
    expect(output).toContain('shipkit');
    expect(output).toContain('Usage:');
  });

  it('--version prints version', () => {
    const output = execSync(`node ${BIN} --version`, { encoding: 'utf-8' });
    expect(output).toContain('1.0.0');
  });

  it('detect command runs', () => {
    const output = execSync(`node ${BIN} detect`, { encoding: 'utf-8' });
    expect(output).toContain('Detecting');
  });

  it('agents command lists agents', () => {
    const output = execSync(`node ${BIN} agents`, { encoding: 'utf-8' });
    expect(output).toContain('@code');
    expect(output).toContain('orchestrator');
  });

  it('skills command lists skills', () => {
    const output = execSync(`node ${BIN} skills`, { encoding: 'utf-8' });
    expect(output).toContain('Skill Catalog');
    expect(output).toContain('skills');
  });

  it('pipeline --status shows phases', () => {
    const output = execSync(`node ${BIN} pipeline --status`, { encoding: 'utf-8' });
    expect(output).toContain('Auto-Detect');
    expect(output).toContain('Auto-advance');
  });

  it('convert --help shows conversion info', () => {
    const output = execSync(`node ${BIN} convert --help`, { encoding: 'utf-8' });
    expect(output).toContain('convert');
  });

  it('quality --help shows quality info', () => {
    const output = execSync(`node ${BIN} quality --help`, { encoding: 'utf-8' });
    expect(output).toContain('quality');
  });

  it('init --help shows install info', () => {
    const output = execSync(`node ${BIN} init --help`, { encoding: 'utf-8' });
    expect(output).toContain('init');
  });
});
