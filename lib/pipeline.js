#!/usr/bin/env node
/**
 * shipkit — 6-Phase Gated Pipeline Engine
 *
 * Manages the project lifecycle through 6 phases with gates between each.
 * Supports auto-advance mode for hands-off execution.
 *
 * @license MIT
 * @author Akakaui
 */

/**
 * @typedef {object} Phase
 * @property {number} id
 * @property {string} name
 * @property {string} gate - Description of the gate condition
 */

/**
 * @typedef {object} PipelineState
 * @property {number} currentPhase
 * @property {boolean} autoAdvance
 * @property {Set<string>} completedPhases
 * @property {object} artifacts
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Pipeline definition.
 */
export const PIPELINE = [
  { id: -1, name: 'Auto-Detect', agent: 'auto-detect', gate: 'Profile confirmed', asks: false },
  { id: 0, name: 'Inception', agent: 'planner', gate: 'Brief approved', asks: true },
  { id: 1, name: 'Plan', agent: 'planner', gate: 'Plan approved', asks: true },
  { id: 2, name: 'Architecture', agent: 'architect', gate: 'Architecture approved', asks: true },
  { id: 3, name: 'Build', agent: 'frontend/backend', gate: 'All P0 built + tests pass', asks: false },
  { id: 4, name: 'Quality', agent: 'tester/reviewer', gate: 'QA pass (70%+ coverage, 0 high issues)', asks: true },
  { id: 5, name: 'Deploy', agent: 'deployer', gate: 'Production healthy', asks: true },
  { id: 6, name: 'Operate', agent: 'ops-monitor', gate: 'Continuous', asks: false },
];

/**
 * Pipeline engine class.
 */
export class Pipeline {
  constructor(options = {}) {
    this.currentPhase = options.startPhase ?? -1;
    this.autoAdvance = options.autoAdvance ?? false;
    this.completedPhases = new Set(options.completedPhases || []);
    this.artifacts = options.artifacts || {};
    this.projectPath = options.projectPath || process.cwd();
    this.statePath = join(this.projectPath, '.shipkit', 'pipeline-state.json');
  }

  /**
   * Get the current phase definition.
   * @returns {Phase|null}
   */
  getCurrentPhase() {
    return PIPELINE.find(p => p.id === this.currentPhase) || null;
  }

  /**
   * Check if the current phase can advance.
   * @param {object} [gateResult] - Optional gate check result
   * @returns {{ canAdvance: boolean, reason: string }}
   */
  checkGate(gateResult = { passed: true }) {
    const phase = this.getCurrentPhase();
    if (!phase) return { canAdvance: false, reason: 'No active phase' };

    if (!gateResult.passed) {
      return { canAdvance: false, reason: gateResult.reason || 'Gate check failed' };
    }

    if (phase.asks && !this.autoAdvance) {
      return { canAdvance: false, reason: `Gate: ${phase.gate} — awaiting approval` };
    }

    return { canAdvance: true, reason: '' };
  }

  /**
   * Advance to the next phase.
   * @param {object} [gateResult]
   * @returns {{ phase: Phase, gate: { canAdvance: boolean, reason: string } }}
   */
  advance(gateResult = { passed: true }) {
    const gate = this.checkGate(gateResult);

    if (!gate.canAdvance) {
      return { phase: this.getCurrentPhase(), gate };
    }

    this.completedPhases.add(String(this.currentPhase));

    const nextIndex = PIPELINE.findIndex(p => p.id === this.currentPhase) + 1;
    if (nextIndex >= PIPELINE.length) {
      return { phase: null, gate: { canAdvance: false, reason: 'Pipeline complete' } };
    }

    this.currentPhase = PIPELINE[nextIndex].id;
    return { phase: this.getCurrentPhase(), gate };
  }

  /**
   * Skip to a specific phase.
   * @param {number} phaseId
   */
  skipTo(phaseId) {
    const target = PIPELINE.find(p => p.id === phaseId);
    if (!target) throw new Error(`Unknown phase: ${phaseId}`);

    // Mark all phases up to target as completed
    for (const phase of PIPELINE) {
      if (phase.id < phaseId) {
        this.completedPhases.add(String(phase.id));
      }
    }
    this.currentPhase = phaseId;
  }

  /**
   * Enable auto-advance mode.
   */
  enableAutoAdvance() {
    this.autoAdvance = true;
  }

  /**
   * Disable auto-advance mode.
   */
  disableAutoAdvance() {
    this.autoAdvance = false;
  }

  /**
   * Record an artifact from the current phase.
   * @param {string} name
   * @param {string} content
   */
  async recordArtifact(name, content) {
    this.artifacts[name] = content;
    const artifactsDir = join(this.projectPath, '.shipkit', 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(join(artifactsDir, name), content);
  }

  /**
   * Save pipeline state to disk.
   */
  async save() {
    const stateDir = join(this.projectPath, '.shipkit');
    await mkdir(stateDir, { recursive: true });
    await writeFile(this.statePath, JSON.stringify({
      currentPhase: this.currentPhase,
      autoAdvance: this.autoAdvance,
      completedPhases: [...this.completedPhases],
      artifactNames: Object.keys(this.artifacts),
    }, null, 2));
  }

  /**
   * Load pipeline state from disk.
   * @param {string} projectPath
   * @returns {Promise<Pipeline>}
   */
  static async load(projectPath) {
    const statePath = join(projectPath, '.shipkit', 'pipeline-state.json');
    try {
      const raw = await readFile(statePath, 'utf-8');
      const data = JSON.parse(raw);
      return new Pipeline({
        startPhase: data.currentPhase,
        autoAdvance: data.autoAdvance,
        completedPhases: data.completedPhases || [],
        projectPath,
      });
    } catch {
      return new Pipeline({ projectPath });
    }
  }

  /**
   * Get a summary of pipeline status.
   * @returns {string}
   */
  getStatus() {
    const current = this.getCurrentPhase();
    const completed = PIPELINE.filter(p => this.completedPhases.has(String(p.id)));
    const remaining = PIPELINE.filter(p => !this.completedPhases.has(String(p.id)));

    let status = `Phase ${current ? current.id : '?'}: ${current ? current.name : 'Complete'}\n`;
    status += `Auto-advance: ${this.autoAdvance ? 'ON' : 'OFF'}\n\n`;
    status += 'Completed:\n';
    for (const p of completed) status += `  ✅ Phase ${p.id}: ${p.name}\n`;
    status += '\nRemaining:\n';
    for (const p of remaining) status += `  ⏳ Phase ${p.id}: ${p.name} (gate: ${p.gate})\n`;

    return status;
  }
}

export default Pipeline;
