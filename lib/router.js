#!/usr/bin/env node
/**
 * shipkit — CODE Orchestrator Router
 *
 * Routes user requests to the appropriate agent based on intent.
 * This is the core of the CODE operating system — it decides who handles what.
 *
 * @license MIT
 * @author Akakaui
 */

/**
 * Phase definitions for the 6-phase pipeline.
 */
export const PHASES = {
  DETECT: { id: -1, name: 'Auto-Detect', gate: 'Profile confirmed' },
  PLAN: { id: 0, name: 'Inception', gate: 'Brief approved' },
  PLAN_DETAIL: { id: 1, name: 'Plan', gate: 'Plan approved' },
  ARCHITECT: { id: 2, name: 'Architecture', gate: 'Architecture approved' },
  BUILD: { id: 3, name: 'Build', gate: 'All P0 built + tests pass' },
  QUALITY: { id: 4, name: 'Quality', gate: 'QA pass (70%+, 0 high)' },
  DEPLOY: { id: 5, name: 'Deploy', gate: 'Production healthy' },
  OPERATE: { id: 6, name: 'Operate', gate: 'Continuous' },
};

/**
 * Routing table: maps user intent → agent + phase.
 */
export const ROUTING_TABLE = [
  {
    patterns: ['plan my project', 'i have an idea', 'plan this', 'what should I build'],
    agent: 'planner',
    phase: PHASES.PLAN,
  },
  {
    patterns: ['detect', 'profile this', 'what am I building', 'classify'],
    agent: 'auto-detect',
    phase: PHASES.DETECT,
  },
  {
    patterns: ['choose stack', 'architecture', 'design the system', 'data model', 'tech stack'],
    agent: 'architect',
    phase: PHASES.ARCHITECT,
  },
  {
    patterns: ['build ui', 'make the frontend', 'frontend', 'user interface', 'ui component'],
    agent: 'frontend',
    phase: PHASES.BUILD,
  },
  {
    patterns: ['build api', 'backend', 'set up the backend', 'database', 'api endpoint', 'server'],
    agent: 'backend',
    phase: PHASES.BUILD,
  },
  {
    patterns: ['mobile app', 'react native', 'expo', 'build mobile'],
    agent: 'mobile',
    phase: PHASES.BUILD,
  },
  {
    patterns: ['extension', 'chrome extension', 'browser extension'],
    agent: 'extension',
    phase: PHASES.BUILD,
  },
  {
    patterns: ['write tests', 'run tests', 'test coverage', 'unit test', 'integration test'],
    agent: 'tester',
    phase: PHASES.QUALITY,
  },
  {
    patterns: ['review code', 'code review', 'is it ready', 'handoff', 'quality check'],
    agent: 'reviewer',
    phase: PHASES.QUALITY,
  },
  {
    patterns: ['check security', 'security audit', 'vulnerability', 'owasp', 'secure'],
    agent: 'security',
    phase: PHASES.QUALITY,
  },
  {
    patterns: ['deploy', 'set up ci/cd', 'infrastructure', 'production deploy', 'release'],
    agent: 'deployer',
    phase: PHASES.DEPLOY,
  },
  {
    patterns: ['watch repo', 'check pr', 'github status', 'pull request'],
    agent: 'github-tracker',
    phase: PHASES.OPERATE,
  },
  {
    patterns: ['monitor', 'check logs', 'uptime', 'alerts', 'production status'],
    agent: 'ops-monitor',
    phase: PHASES.OPERATE,
  },
  {
    patterns: ['project state', 'what\'s the status', 'where are we', 'progress'],
    agent: 'code',
    phase: null,
  },
  {
    patterns: ['run autonomously', 'auto mode', 'full speed', 'go ahead'],
    agent: 'code',
    phase: null,
    action: 'enableAutoAdvance',
  },
];

/**
 * Route a user request to the appropriate agent.
 * @param {string} input - User's message
 * @returns {{ agent: string, phase: object|null, confidence: number, action: string|null }}
 */
export function route(input) {
  const normalized = input.toLowerCase().trim();

  let bestMatch = null;
  let highestConfidence = 0;

  for (const entry of ROUTING_TABLE) {
    for (const pattern of entry.patterns) {
      if (normalized.includes(pattern)) {
        const confidence = pattern.length / normalized.length;
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            agent: entry.agent,
            phase: entry.phase,
            confidence: Math.round(confidence * 100),
            action: entry.action || null,
            matchedPattern: pattern,
          };
        }
      }
    }
  }

  return bestMatch || {
    agent: 'code',
    phase: null,
    confidence: 0,
    action: null,
    matchedPattern: null,
  };
}

/**
 * Route by explicit agent mention (@planner, @frontend, etc.)
 * @param {string} input
 * @returns {{ agent: string, phase: object|null }|null}
 */
export function routeByMention(input) {
  const mentionMatch = input.match(/@(\w+)/);
  if (!mentionMatch) return null;

  const mentioned = mentionMatch[1].toLowerCase();
  for (const entry of ROUTING_TABLE) {
    if (entry.agent === mentioned) {
      return { agent: entry.agent, phase: entry.phase };
    }
  }

  // Check direct agent names
  const AGENT_NAMES = [
    'planner', 'architect', 'frontend', 'backend', 'mobile', 'extension',
    'tester', 'reviewer', 'security', 'deployer', 'code', 'auto-detect',
    'github-tracker', 'ops-monitor',
  ];
  if (AGENT_NAMES.includes(mentioned)) {
    const entry = ROUTING_TABLE.find(e => e.agent === mentioned);
    return { agent: mentioned, phase: entry ? entry.phase : null };
  }

  return null;
}

/**
 * List all available agents with their descriptions.
 */
export function listAgents() {
  return [
    { name: '@code', role: 'Master orchestrator', phase: 'All' },
    { name: '@auto-detect', role: 'Classifies project type, loads skills', phase: 'Detect' },
    { name: '@planner', role: 'Requirements, scope, features', phase: 'Plan' },
    { name: '@architect', role: 'Stack, data model, API design', phase: 'Architect' },
    { name: '@frontend', role: 'UI components, state, routing', phase: 'Build' },
    { name: '@backend', role: 'APIs, databases, auth', phase: 'Build' },
    { name: '@mobile', role: 'React Native / Expo apps', phase: 'Build' },
    { name: '@extension', role: 'Chrome Manifest V3 extensions', phase: 'Build' },
    { name: '@tester', role: 'Unit, integration, E2E tests', phase: 'Quality' },
    { name: '@security', role: 'Vulnerability scanning, OWASP', phase: 'Quality' },
    { name: '@reviewer', role: 'Code quality, handoff readiness', phase: 'Quality' },
    { name: '@deployer', role: 'CI/CD, infra, monitoring', phase: 'Deploy' },
    { name: '@github-tracker', role: 'PRs, issues, releases', phase: 'Operate' },
    { name: '@ops-monitor', role: 'Logs, metrics, uptime', phase: 'Operate' },
  ];
}

export default { route, routeByMention, listAgents, PHASES, ROUTING_TABLE };
