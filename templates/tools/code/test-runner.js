#!/usr/bin/env node
/**
 * Test Runner - Runs tests and checks coverage
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIN_COVERAGE = {
  statements: 70,
  branches: 70,
  functions: 70,
  lines: 70,
};

function runTests(projectRoot, options = {}) {
  const { watch = false, coverage = true, ci = false } = options;

  console.log('Running tests...');

  // Check if package.json exists
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('No package.json found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Determine test command
  let testCommand = 'npm test';
  if (packageJson.scripts?.test) {
    testCommand = 'npm test';
  } else if (packageJson.scripts?.test) {
    testCommand = 'npm test';
  }

  // Build command
  let cmd = testCommand;
  if (watch) cmd += ' -- --watch';
  if (coverage) cmd += ' -- --coverage';
  if (ci) cmd += ' -- --ci --maxWorkers=2';

  try {
    execSync(cmd, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('Tests passed!');
    return true;
  } catch (error) {
    console.error('Tests failed!');
    return false;
  }
}

function checkCoverage(projectRoot) {
  const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(coveragePath)) {
    console.warn('No coverage report found');
    return false;
  }

  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;

  let passed = true;
  Object.keys(MIN_COVERAGE).forEach(metric => {
    if (total[metric]?.pct < MIN_COVERAGE[metric]) {
      console.error(`Coverage FAIL: ${metric} ${total[metric]?.pct}% < ${MIN_COVERAGE[metric]}%`);
      passed = false;
    } else {
      console.log(`Coverage PASS: ${metric} ${total[metric]?.pct}% >= ${MIN_COVERAGE[metric]}%`);
    }
  });

  return passed;
}

function runAll(projectRoot) {
  const testsPassed = runTests(projectRoot, { ci: true });
  if (!testsPassed) {
    return false;
  }

  const coveragePassed = checkCoverage(projectRoot);
  if (!coveragePassed) {
    console.error('Coverage requirements not met');
    return false;
  }

  console.log('All tests passed and coverage requirements met!');
  return true;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const command = args[1] || 'run';

  switch (command) {
    case 'run':
      runTests(projectRoot);
      break;
    case 'coverage':
      checkCoverage(projectRoot);
      break;
    case 'all':
      runAll(projectRoot);
      break;
    case 'watch':
      runTests(projectRoot, { watch: true, coverage: false });
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = { runTests, checkCoverage, runAll, MIN_COVERAGE };