#!/usr/bin/env node
/**
 * Scaffolder - Creates project structure based on type and scope
 */

const fs = require('fs');
const path = require('path');

const structures = {
  'web-landing': [
    'src/components',
    'src/pages',
    'src/styles',
    'public',
  ],
  'web-interactive': [
    'src/components',
    'src/features',
    'src/hooks',
    'src/utils',
    'src/types',
    'src/styles',
    'public',
  ],
  'web-lightweight': [
    'src/components',
    'src/features',
    'src/hooks',
    'src/services',
    'src/utils',
    'src/types',
    'src/api',
    'src/styles',
    'public',
    'server',
  ],
  'web-full': [
    'src/components',
    'src/features',
    'src/hooks',
    'src/services',
    'src/utils',
    'src/types',
    'src/api',
    'src/styles',
    'public',
    'server',
    'database',
    'scripts',
    'docs',
  ],
  'mobile-single': [
    'src/components',
    'src/screens',
    'src/hooks',
    'src/utils',
    'src/types',
    'src/navigation',
    'assets',
  ],
  'mobile-multi': [
    'src/components',
    'src/features',
    'src/screens',
    'src/hooks',
    'src/services',
    'src/utils',
    'src/types',
    'src/navigation',
    'src/state',
    'assets',
  ],
  'mobile-lightweight': [
    'src/components',
    'src/features',
    'src/screens',
    'src/hooks',
    'src/services',
    'src/utils',
    'src/types',
    'src/navigation',
    'src/state',
    'assets',
    'server',
  ],
  'mobile-full': [
    'src/components',
    'src/features',
    'src/screens',
    'src/hooks',
    'src/services',
    'src/utils',
    'src/types',
    'src/navigation',
    'src/state',
    'assets',
    'server',
    'database',
    'scripts',
    'docs',
  ],
  'extension-simple': [
    'src/popup',
    'src/background',
    'src/shared',
    'public',
  ],
  'extension-interactive': [
    'src/popup',
    'src/background',
    'src/content',
    'src/shared',
    'public',
  ],
  'extension-full': [
    'src/popup',
    'src/background',
    'src/content',
    'src/options',
    'src/shared',
    'public',
    'scripts',
    'docs',
  ],
};

function getKey(type, scope) {
  const scopeMap = {
    'Landing Page': 'landing',
    'Interactive Frontend': 'interactive',
    'Lightweight Web App': 'lightweight',
    'Full-Scale Web App': 'full',
    'Single-screen / Landing-like App': 'single',
    'Multi-screen interactive App': 'multi',
    'Lightweight App with Backend': 'lightweight',
    'Full-Scale Production Mobile App': 'full',
    'Simple extension': 'simple',
    'Interactive extension': 'interactive',
    'Full-featured extension': 'full',
  };
  const scopeKey = scopeMap[scope] || scope.toLowerCase().replace(/\s+/g, '-');
  return `${type}-${scopeKey}`;
}

function createStructure(projectRoot, type, scope) {
  const key = getKey(type, scope);
  const structure = structures[key] || structures['web-lightweight'];

  console.log(`Creating structure for: ${key}`);
  console.log(`Project root: ${projectRoot}`);

  structure.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created: ${dir}`);
    }
  });

  // Create README.md in each feature folder
  structure.forEach(dir => {
    if (dir.startsWith('src/features') || dir.startsWith('src/screens') || dir.startsWith('src/features')) {
      const readmePath = path.join(projectRoot, dir, 'README.md');
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, `# ${path.basename(dir)}\n\nFeature folder for ${path.basename(dir)}.\n`);
      }
    }
  });

  console.log('Structure created successfully!');
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node scaffolder.js <project-root> <type> <scope>');
    console.error('Types: web, mobile, extension');
    console.error('Scopes: vary by type');
    process.exit(1);
  }
  createStructure(args[0], args[1], args[2]);
}

module.exports = { createStructure, structures };