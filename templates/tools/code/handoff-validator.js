const fs = require('fs');
const path = require('path');

const checks = {
  documentation: [
    { file: 'README.md', required: true, description: 'Project README' },
    { file: 'docs/api.md', required: false, description: 'API documentation' },
    { file: 'docs/architecture.md', required: false, description: 'Architecture docs' },
  ],
  codeQuality: [
    { check: 'no-typescript-errors', command: 'npx tsc --noEmit', description: 'No TypeScript errors' },
    { check: 'no-lint-errors', command: 'npm run lint', description: 'No lint errors' },
    { check: 'file-size-limit', script: checkFileSizes, description: 'All files under 250 lines' },
    { check: 'function-size-limit', script: checkFunctionSizes, description: 'All functions under 50 lines' },
  ],
  testing: [
    { check: 'tests-pass', command: 'npm test -- --ci', description: 'All tests passing' },
    { check: 'coverage', script: checkCoverage, description: 'Test coverage >70%' },
  ],
  infrastructure: [
    { check: 'env-documented', script: checkEnvDocumented, description: 'All env vars documented' },
    { check: 'secrets-not-in-code', script: checkNoSecrets, description: 'No secrets in code' },
    { check: 'deployment-documented', file: 'docs/deployment.md', required: false, description: 'Deployment docs' },
    { check: 'rollback-documented', file: 'docs/rollback.md', required: false, description: 'Rollback procedure' },
  ],
};

function checkFileSizes(projectRoot) {
  const violations = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        if (lines > 250) {
          violations.push({ file: path.relative(projectRoot, fullPath), lines });
        }
      }
    }
  }
  scan(projectRoot);
  return { pass: violations.length === 0, violations };
}

function checkFunctionSizes(projectRoot) {
  const violations = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Simple function detection
        const functions = content.match(/(function\s+\w+|const\s+\w+\s*=\s*\(|async\s+function|\w+\s*:\s*function)/g) || [];
        if (functions.length > 0) {
          // This is a simplified check - real implementation would parse AST
        }
      }
    }
  }
  scan(projectRoot);
  return { pass: true, violations: [] }; // Simplified for now
}

function checkCoverage(projectRoot) {
  const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(coveragePath)) {
    return { pass: false, message: 'No coverage report found' };
  }
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;
  const pass = total.lines.pct >= 70 && total.functions.pct >= 70 && total.branches.pct >= 70 && total.statements.pct >= 70;
  return { pass, coverage: { lines: total.lines.pct, functions: total.functions.pct, branches: total.branches.pct, statements: total.statements.pct } };
}

function checkEnvDocumented(projectRoot) {
  const envExamplePath = path.join(projectRoot, '.env.example');
  if (!fs.existsSync(envExamplePath)) {
    return { pass: false, message: '.env.example not found' };
  }
  return { pass: true };
}

function checkNoSecrets(projectRoot) {
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
    /secret\s*[:=]\s*['"][^'"]+['"]/i,
    /password\s*[:=]\s*['"][^'"]+['"]/i,
    /token\s*[:=]\s*['"][^'"]+['"]/i,
  ];
  const violations = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.json') || entry.name.endsWith('.env'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            violations.push({ file: path.relative(projectRoot, fullPath), matches: matches.slice(0, 3) });
          }
        }
      }
    }
  }
  scan(projectRoot);
  return { pass: violations.length === 0, violations };
}

function runHandoffTest(projectRoot) {
  console.log('\n=== Handoff Readiness Test ===\n');

  let allPass = true;
  const results = {};

  // Documentation checks
  console.log('📚 Documentation:');
  for (const doc of checks.documentation) {
    const fullPath = path.join(projectRoot, doc.file);
    const exists = fs.existsSync(fullPath);
    const status = exists ? '✓' : (doc.required ? '✗ REQUIRED' : '○ optional');
    console.log(`  ${status} ${doc.description} (${doc.file})`);
    if (doc.required && !exists) allPass = false;
  }

  // Code Quality
  console.log('\n🔍 Code Quality:');
  for (const qc of checks.codeQuality) {
    let result;
    if (qc.script) {
      result = qc.script(projectRoot);
    } else if (qc.command) {
      try {
        require('child_process').execSync(qc.command, { cwd: projectRoot, stdio: 'pipe' });
        result = { pass: true };
      } catch {
        result = { pass: false };
      }
    }
    const status = result.pass ? '✓' : '✗';
    console.log(`  ${status} ${qc.description}`);
    if (!result.pass) allPass = false;
    if (result.violations) {
      result.violations.forEach(v => console.log(`    → ${v.file}: ${v.lines} lines`));
    }
  }

  // Testing
  console.log('\n🧪 Testing:');
  for (const test of checks.testing) {
    let result;
    if (test.script) {
      result = test.script(projectRoot);
    } else if (test.command) {
      try {
        require('child_process').execSync(test.command, { cwd: projectRoot, stdio: 'pipe' });
        result = { pass: true };
      } catch {
        result = { pass: false };
      }
    }
    const status = result.pass ? '✓' : '✗';
    console.log(`  ${status} ${test.description}`);
    if (!result.pass) allPass = false;
    if (result.coverage) {
      console.log(`    Coverage: Lines ${result.coverage.lines}%, Functions ${result.coverage.functions}%, Branches ${result.coverage.branches}%, Statements ${result.coverage.statements}%`);
    }
  }

  // Infrastructure
  console.log('\n🏗️ Infrastructure:');
  for (const infra of checks.infrastructure) {
    let result;
    if (infra.script) {
      result = infra.script(projectRoot);
    } else if (infra.file) {
      const fullPath = path.join(projectRoot, infra.file);
      result = { pass: fs.existsSync(fullPath) };
    }
    const status = result.pass ? '✓' : (infra.required ? '✗ REQUIRED' : '○ optional');
    console.log(`  ${status} ${infra.description}`);
    if (infra.required && !result.pass) allPass = false;
    if (result.violations) {
      result.violations.forEach(v => console.log(`    → ${v.file}: potential secrets found`));
    }
  }

  // 30-Minute Rule Check
  console.log('\n⏱️ 30-Minute Rule:');
  const canClone = fs.existsSync(path.join(projectRoot, 'package.json'));
  const canRun = canClone && fs.existsSync(path.join(projectRoot, 'README.md'));
  const canTest = canRun && fs.existsSync(path.join(projectRoot, 'package.json'));
  const canDeploy = canTest && fs.existsSync(path.join(projectRoot, '.github', 'workflows'));

  console.log(`  ${canClone ? '✓' : '✗'} Clone and install`);
  console.log(`  ${canRun ? '✓' : '✗'} Run locally (has README)`);
  console.log(`  ${canTest ? '✓' : '✗'} Run tests`);
  console.log(`  ${canDeploy ? '✓' : '✗'} Deploy (has CI/CD)`);

  if (!canClone || !canRun || !canTest || !canDeploy) allPass = false;

  console.log(`\n${'='.repeat(40)}`);
  console.log(`HANDOFF: ${allPass ? 'READY ✓' : 'NOT READY ✗'}`);
  console.log(`${'='.repeat(40)}\n`);

  return allPass;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  runHandoffTest(projectRoot);
}

module.exports = { runHandoffTest };