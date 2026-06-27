const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const environments = {
  dev: { command: 'npm run dev', url: 'http://localhost:3000' },
  staging: { command: 'npm run deploy:staging', url: 'https://staging.example.com' },
  production: { command: 'npm run deploy:prod', url: 'https://example.com' },
};

function setupCI(projectRoot) {
  const githubDir = path.join(projectRoot, '.github', 'workflows');
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const workflow = `name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --ci --coverage
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - run: echo "Deploy to staging"
      - run: echo "STAGING_URL=${{ secrets.STAGING_URL }}" >> $GITHUB_ENV

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - run: echo "Deploy to production"
      - run: echo "PRODUCTION_URL=${{ secrets.PRODUCTION_URL }}" >> $GITHUB_ENV
`;

  const workflowPath = path.join(githubDir, 'ci-cd.yml');
  fs.writeFileSync(workflowPath, workflow);
  console.log('Created CI/CD workflow: .github/workflows/ci-cd.yml');
}

function deploy(projectRoot, environment, options = {}) {
  const { force = false, dryRun = false } = options;

  if (!environments[environment]) {
    console.error(`Unknown environment: ${environment}`);
    console.log('Available: dev, staging, production');
    return false;
  }

  console.log(`\n=== Deploying to ${environment} ===`);

  // Check if we're on correct branch
  try {
    const branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf8' }).trim();
    const expectedBranch = environment === 'production' ? 'main' : environment === 'staging' ? 'develop' : 'any';
    if (expectedBranch !== 'any' && branch !== expectedBranch) {
      console.warn(`Warning: Not on ${expectedBranch} branch (currently on ${branch})`);
      if (!force) {
        console.error('Use --force to deploy anyway');
        return false;
      }
    }
  } catch {
    console.warn('Could not determine git branch');
  }

  // Run tests first
  if (!dryRun) {
    console.log('Running tests...');
    try {
      execSync('npm test -- --ci', { cwd: projectRoot, stdio: 'inherit' });
    } catch {
      console.error('Tests failed! Aborting deployment.');
      return false;
    }
  }

  // Build
  if (!dryRun) {
    console.log('Building...');
    try {
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    } catch {
      console.error('Build failed! Aborting deployment.');
      return false;
    }
  }

  // Deploy
  if (!dryRun) {
    console.log(`Deploying to ${environment}...`);
    try {
      execSync(environments[environment].command, { cwd: projectRoot, stdio: 'inherit' });
      console.log(`Deployed to ${environment}: ${environments[environment].url}`);
    } catch (error) {
      console.error(`Deployment to ${environment} failed!`);
      return false;
    }
  } else {
    console.log(`[DRY RUN] Would run: ${environments[environment].command}`);
  }

  return true;
}

function rollback(projectRoot, environment) {
  console.log(`Rolling back ${environment}...`);
  // Implementation depends on deployment platform
  console.log('Rollback procedure:');
  console.log('1. Identify previous successful deployment');
  console.log('2. Redeploy that version');
  console.log('3. Verify functionality');
  console.log('4. Notify team');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const command = args[1] || 'help';

  switch (command) {
    case 'setup':
      setupCI(projectRoot);
      break;
    case 'dev':
      deploy(projectRoot, 'dev', { dryRun: args.includes('--dry-run'), force: args.includes('--force') });
      break;
    case 'staging':
      deploy(projectRoot, 'staging', { dryRun: args.includes('--dry-run'), force: args.includes('--force') });
      break;
    case 'production':
      deploy(projectRoot, 'production', { dryRun: args.includes('--dry-run'), force: args.includes('--force') });
      break;
    case 'rollback':
      rollback(projectRoot, args[2] || 'production');
      break;
    default:
      console.log('Usage: deploy-pipeline <project-root> <command>');
      console.log('Commands: setup, dev, staging, production, rollback');
  }
}

module.exports = { setupCI, deploy, rollback };