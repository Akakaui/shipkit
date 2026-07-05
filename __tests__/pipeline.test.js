#!/usr/bin/env node
/**
 * Tests for lib/pipeline.js
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Pipeline, PIPELINE } from '../lib/pipeline.js';
import { mkdtempSync, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('pipeline.js — 6-Phase Gated Pipeline', () => {
  let pipeline;
  let tmpDir;

  beforeEach(() => {
    pipeline = new Pipeline();
    tmpDir = mkdtempSync(join(tmpdir(), 'shipkit-test-'));
  });

  describe('Pipeline class', () => {
    it('starts at phase -1 by default', () => {
      expect(pipeline.currentPhase).toBe(-1);
    });

    it('autoAdvance defaults to false', () => {
      expect(pipeline.autoAdvance).toBe(false);
    });

    it('accepts custom options', () => {
      const p = new Pipeline({ startPhase: 3, autoAdvance: true, completedPhases: ['0', '1', '2'] });
      expect(p.currentPhase).toBe(3);
      expect(p.autoAdvance).toBe(true);
      expect(p.completedPhases.has('0')).toBe(true);
    });
  });

  describe('getCurrentPhase()', () => {
    it('returns Auto-Detect for phase -1', () => {
      const phase = pipeline.getCurrentPhase();
      expect(phase).not.toBeNull();
      expect(phase.name).toBe('Auto-Detect');
    });

    it('returns null for unknown phase', () => {
      const p = new Pipeline({ startPhase: 999 });
      expect(p.getCurrentPhase()).toBeNull();
    });
  });

  describe('checkGate()', () => {
    it('allows advance when gate passes and phase does not ask', () => {
      pipeline.currentPhase = -1; // Auto-Detect, asks: false
      const result = pipeline.checkGate({ passed: true });
      expect(result.canAdvance).toBe(true);
    });

    it('blocks advance when gate fails', () => {
      const result = pipeline.checkGate({ passed: false, reason: 'Tests failing' });
      expect(result.canAdvance).toBe(false);
      expect(result.reason).toContain('Tests failing');
    });

    it('blocks advance when phase asks and autoAdvance is off', () => {
      pipeline.currentPhase = 0; // Inception, asks: true
      const result = pipeline.checkGate({ passed: true });
      expect(result.canAdvance).toBe(false);
      expect(result.reason).toContain('awaiting approval');
    });

    it('allows advance when phase asks and autoAdvance is on', () => {
      pipeline.currentPhase = 0; // Inception, asks: true
      pipeline.autoAdvance = true;
      const result = pipeline.checkGate({ passed: true });
      expect(result.canAdvance).toBe(true);
    });
  });

  describe('advance()', () => {
    it('advances from -1 to 0 when gate passes', () => {
      pipeline.currentPhase = -1;
      const result = pipeline.advance({ passed: true });
      expect(result.phase.id).toBe(0);
      expect(result.gate.canAdvance).toBe(true);
    });

    it('does not advance when gate fails', () => {
      const result = pipeline.advance({ passed: false });
      expect(result.phase).not.toBeNull();
      expect(result.gate.canAdvance).toBe(false);
    });

    it('does not advance when approval needed', () => {
      pipeline.currentPhase = 0; // Inception asks
      const result = pipeline.advance({ passed: true });
      expect(result.gate.canAdvance).toBe(false);
    });

    it('returns pipeline complete when at last phase', () => {
      pipeline.currentPhase = 6;
      pipeline.completedPhases = new Set(['-1','0','1','2','3','4','5']);
      pipeline.autoAdvance = true;
      const result = pipeline.advance({ passed: true });
      expect(result.phase).toBeNull();
    });
  });

  describe('skipTo()', () => {
    it('jumps to target phase', () => {
      pipeline.skipTo(3);
      expect(pipeline.currentPhase).toBe(3);
    });

    it('marks earlier phases as completed', () => {
      pipeline.skipTo(3);
      expect(pipeline.completedPhases.has('-1')).toBe(true);
      expect(pipeline.completedPhases.has('0')).toBe(true);
      expect(pipeline.completedPhases.has('1')).toBe(true);
      expect(pipeline.completedPhases.has('2')).toBe(true);
    });

    it('throws for unknown phase', () => {
      expect(() => pipeline.skipTo(999)).toThrow();
    });
  });

  describe('autoAdvance', () => {
    it('enableAutoAdvance sets to true', () => {
      pipeline.enableAutoAdvance();
      expect(pipeline.autoAdvance).toBe(true);
    });

    it('disableAutoAdvance sets to false', () => {
      pipeline.enableAutoAdvance();
      pipeline.disableAutoAdvance();
      expect(pipeline.autoAdvance).toBe(false);
    });
  });

  describe('save/load', () => {
    it('saves and loads pipeline state', async () => {
      const p = new Pipeline({ startPhase: 2, projectPath: tmpDir, completedPhases: ['-1','0','1'] });
      await p.save();

      const loaded = await Pipeline.load(tmpDir);
      expect(loaded.currentPhase).toBe(2);
      expect(loaded.autoAdvance).toBe(false);
    });

    it('load returns fresh pipeline for missing state', async () => {
      const loaded = await Pipeline.load(tmpDir);
      expect(loaded.currentPhase).toBe(-1);
    });

    it('saves to .shipkit/pipeline-state.json', async () => {
      const p = new Pipeline({ projectPath: tmpDir });
      await p.save();
      const statePath = join(tmpDir, '.shipkit', 'pipeline-state.json');
      expect(existsSync(statePath)).toBe(true);
    });
  });

  describe('recordArtifact()', () => {
    it('creates artifact file', async () => {
      const p = new Pipeline({ projectPath: tmpDir });
      await p.recordArtifact('plan.md', '# Plan content');
      const artPath = join(tmpDir, '.shipkit', 'artifacts', 'plan.md');
      expect(existsSync(artPath)).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('returns a string summary', () => {
      const status = pipeline.getStatus();
      expect(typeof status).toBe('string');
      expect(status).toContain('Auto-Detect');
      expect(status).toContain('Auto-advance');
    });

    it('shows completed and remaining phases', () => {
      pipeline.completedPhases.add('-1');
      const status = pipeline.getStatus();
      expect(status).toContain('✅');
      expect(status).toContain('⏳');
    });
  });

  describe('PIPELINE', () => {
    it('has 8 phases', () => {
      expect(PIPELINE.length).toBe(8);
    });

    it('phases have correct shape', () => {
      for (const phase of PIPELINE) {
        expect(phase).toHaveProperty('id');
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('agent');
        expect(phase).toHaveProperty('gate');
        expect(phase).toHaveProperty('asks');
      }
    });

    it('starts at -1 and goes to 6', () => {
      expect(PIPELINE[0].id).toBe(-1);
      expect(PIPELINE[PIPELINE.length - 1].id).toBe(6);
    });
  });
});
