#!/usr/bin/env node
/**
 * Tests for lib/router.js
 */
import { describe, it, expect } from '@jest/globals';
import { route, routeByMention, listAgents, PHASES, ROUTING_TABLE } from '../lib/router.js';

describe('router.js — Request Routing', () => {
  describe('route()', () => {
    it('routes "build UI components" to frontend agent', () => {
      const result = route('build UI components');
      expect(result.agent).toBe('frontend');
      expect(result.phase).toBe(PHASES.BUILD);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('routes "set up the backend" to backend agent', () => {
      const result = route('set up the backend');
      expect(result.agent).toBe('backend');
      expect(result.phase).toBe(PHASES.BUILD);
    });

    it('routes "plan my project" to planner agent', () => {
      const result = route('plan my project');
      expect(result.agent).toBe('planner');
      expect(result.phase).toBe(PHASES.PLAN);
    });

    it('routes "check security" to security agent', () => {
      const result = route('check security');
      expect(result.agent).toBe('security');
      expect(result.phase).toBe(PHASES.QUALITY);
    });

    it('routes "deploy this app" to deployer agent', () => {
      const result = route('deploy this app');
      expect(result.agent).toBe('deployer');
      expect(result.phase).toBe(PHASES.DEPLOY);
    });

    it('routes "run autonomously" to code agent with action', () => {
      const result = route('run autonomously');
      expect(result.agent).toBe('code');
      expect(result.action).toBe('enableAutoAdvance');
    });

    it('routes "write tests" to tester agent', () => {
      const result = route('write tests');
      expect(result.agent).toBe('tester');
      expect(result.phase).toBe(PHASES.QUALITY);
    });

    it('routes "make the frontend" to frontend agent', () => {
      const result = route('make the frontend');
      expect(result.agent).toBe('frontend');
    });

    it('routes "where are we" to code agent', () => {
      const result = route("what's the status");
      expect(result.agent).toBe('code');
    });

    it('returns code agent with 0 confidence for unknown input', () => {
      const result = route('completely unrelated request');
      expect(result.agent).toBe('code');
      expect(result.confidence).toBe(0);
    });

    it('routes "chrome extension" to extension agent', () => {
      const result = route('i need a chrome extension');
      expect(result.agent).toBe('extension');
      expect(result.phase).toBe(PHASES.BUILD);
    });

    it('routes "pull request" to github-tracker', () => {
      const result = route('check my pull request');
      expect(result.agent).toBe('github-tracker');
    });

    it('routes "production status" to ops-monitor', () => {
      const result = route('what is the production status');
      expect(result.agent).toBe('ops-monitor');
    });

    it('is case-insensitive', () => {
      const result = route('BUILD API');
      expect(result.agent).toBe('backend');
    });

    it('selects best match by confidence', () => {
      // "frontend" should match frontend, not backend
      const result = route('frontend component');
      expect(result.agent).toBe('frontend');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('routeByMention()', () => {
    it('routes @planner mention', () => {
      const result = routeByMention('hello @planner do this');
      expect(result).not.toBeNull();
      expect(result.agent).toBe('planner');
    });

    it('routes @backend mention', () => {
      const result = routeByMention('can you @backend do this');
      expect(result).not.toBeNull();
      expect(result.agent).toBe('backend');
    });

    it('returns null for no mention', () => {
      const result = routeByMention('just a normal request');
      expect(result).toBeNull();
    });

    it('returns null for unknown agent', () => {
      const result = routeByMention('@nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listAgents()', () => {
    it('returns 14 agents', () => {
      const agents = listAgents();
      expect(agents.length).toBe(14);
    });

    it('includes @code as master orchestrator', () => {
      const agents = listAgents();
      const code = agents.find(a => a.name === '@code');
      expect(code).toBeDefined();
      expect(code.role).toContain('orchestrator');
    });

    it('every agent has name, role, phase', () => {
      for (const agent of listAgents()) {
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('phase');
        expect(agent.name.startsWith('@')).toBe(true);
      }
    });
  });

  describe('ROUTING_TABLE', () => {
    it('has 15 routing entries', () => {
      expect(ROUTING_TABLE.length).toBe(15);
    });

    it('each entry has patterns array and agent', () => {
      for (const entry of ROUTING_TABLE) {
        expect(Array.isArray(entry.patterns)).toBe(true);
        expect(entry.patterns.length).toBeGreaterThan(0);
        expect(typeof entry.agent).toBe('string');
      }
    });
  });

  describe('PHASES', () => {
    it('has 8 phases including detect', () => {
      expect(PHASES.DETECT.id).toBe(-1);
      expect(PHASES.BUILD.id).toBe(3);
      expect(PHASES.OPERATE.id).toBe(6);
    });

    it('each phase has id, name, gate', () => {
      for (const key of Object.keys(PHASES)) {
        const phase = PHASES[key];
        expect(phase).toHaveProperty('id');
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('gate');
      }
    });
  });
});
