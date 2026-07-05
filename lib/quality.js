#!/usr/bin/env node
/**
 * shipkit — Quality Gates & Checks
 *
 * Enforces production-readiness standards before code is delivered.
 * Each gate checks specific criteria and returns a pass/fail report.
 *
 * @license MIT
 * @author Akakaui
 */

import { readFile, readdir, access } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

/**
 * Quality gate result.
 * @typedef {object} GateResult
 * @property {boolean} passed
 * @property {string} reason
 * @property {Array<{check: string, passed: boolean, detail: string}>} checks
 */

/**
 * Run all quality gates against a project.
 * @param {string} projectPath - Path to the project
 * @returns {Promise<GateResult>}
 */
export async function runAllGates(projectPath) {
  const gates = [
    checkNoConsoleLogs,
    checkNoTodos,
    checkFileSizes,
    checkFunctionSizes,
    checkHasTests,
    checkHasPackageJson,
    checkHasReadme,
    checkHasGitignore,
    checkHasLicense,
  ];

  const checks = [];
  let allPassed = true;

  for (const gate of gates) {
    try {
      const result = await gate(projectPath);
      checks.push(result);
      if (!result.passed) allPassed = false;
    } catch (error) {
      checks.push({ check: gate.name, passed: false, detail: error.message });
      allPassed = false;
    }
  }

  return {
    passed: allPassed,
    reason: allPassed ? 'All quality gates passed' : `${checks.filter(c => !c.passed).length} gate(s) failed`,
    checks,
  };
}

/**
 * Check 1: No console.log statements in source files.
 */
async function checkNoConsoleLogs(projectPath) {
  const srcDir = join(projectPath, 'src');
  try {
    await access(srcDir);
  } catch {
    return { check: 'No console.log', passed: true, detail: 'No src/ directory found' };
  }

  const violations = [];
  const jsFiles = await findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx']);

  for (const file of jsFiles.slice(0, 50)) { // Limit to 50 files
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/console\.(log|debug)\(/)) {
        violations.push(`${file}:${i + 1}`);
      }
    }
  }

  return {
    check: 'No console.log',
    passed: violations.length === 0,
    detail: violations.length
      ? `Found ${violations.length} console.log(s): ${violations.slice(0, 5).join(', ')}`
      : 'No console.log statements found',
  };
}

/**
 * Check 2: No TODO/FIXME/HACK markers in source files.
 */
async function checkNoTodos(projectPath) {
  const srcDir = join(projectPath, 'src');
  try {
    await access(srcDir);
  } catch {
    return { check: 'No TODO markers', passed: true, detail: 'No src/ directory found' };
  }

  const violations = [];
  const files = await findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx', '.css', '.html']);

  for (const file of files.slice(0, 50)) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\b(TODO|FIXME|HACK|XXX)\b/i)) {
        violations.push(`${file}:${i + 1}`);
      }
    }
  }

  return {
    check: 'No TODO/FIXME markers',
    passed: violations.length === 0,
    detail: violations.length
      ? `Found ${violations.length} marker(s): ${violations.slice(0, 5).join(', ')}`
      : 'No TODO/FIXME markers found',
  };
}

/**
 * Check 3: File size limits (250 lines max).
 */
async function checkFileSizes(projectPath) {
  const srcDir = join(projectPath, 'src');
  try {
    await access(srcDir);
  } catch {
    return { check: 'File size limits (≤250 lines)', passed: true, detail: 'No src/ directory found' };
  }

  const violations = [];
  const files = await findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx', '.css']);

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lineCount = content.split('\n').length;
    if (lineCount > 250) {
      violations.push(`${file}: ${lineCount} lines`);
    }
  }

  return {
    check: 'File size limits (≤250 lines)',
    passed: violations.length === 0,
    detail: violations.length
      ? `${violations.length} file(s) exceed 250 lines: ${violations.slice(0, 5).join(', ')}`
      : 'All files within 250-line limit',
  };
}

/**
 * Check 4: Function size limits (50 lines max) — simple heuristic.
 */
async function checkFunctionSizes(projectPath) {
  const srcDir = join(projectPath, 'src');
  try {
    await access(srcDir);
  } catch {
    return { check: 'Function size limits (≤50 lines)', passed: true, detail: 'No src/ directory found' };
  }

  const violations = [];
  const files = await findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx']);

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    let inFunction = false;
    let funcStart = 0;
    let braceDepth = 0;
    let funcLines = 0;

    for (let i = 0; i < lines.length; i++) {
      // Detect function start (heuristic)
      const fnMatch = lines[i].match(/(?:function\s+\w+|=>\s*{|\(\s*[\w\s,]*\)\s*{)/);
      if (fnMatch && !inFunction) {
        inFunction = true;
        funcStart = i + 1;
        braceDepth = 0;
        funcLines = 1;
      }

      if (inFunction) {
        funcLines++;
        braceDepth += (lines[i].match(/{/g) || []).length;
        braceDepth -= (lines[i].match(/}/g) || []).length;
        if (braceDepth <= 0) {
          inFunction = false;
          if (funcLines > 50) {
            violations.push(`${file}:~${funcStart} (${funcLines} lines)`);
          }
        }
      }
    }
  }

  return {
    check: 'Function size limits (≤50 lines)',
    passed: violations.length === 0,
    detail: violations.length
      ? `${violations.length} function(s) exceed 50 lines: ${violations.slice(0, 5).join(', ')}`
      : 'All functions within 50-line limit',
  };
}

/**
 * Check 5: Has tests.
 */
async function checkHasTests(projectPath) {
  const testDirs = ['test', 'tests', '__tests__', 'src/__tests__'];
  let hasTests = false;
  let foundDir = '';

  for (const dir of testDirs) {
    try {
      await access(join(projectPath, dir));
      hasTests = true;
      foundDir = dir;
      break;
    } catch { /* not found */ }
  }

  return {
    check: 'Has tests',
    passed: hasTests,
    detail: hasTests ? `Found tests in ${foundDir}/` : 'No test directory found',
  };
}

/**
 * Check 6: Has package.json.
 */
async function checkHasPackageJson(projectPath) {
  try {
    await access(join(projectPath, 'package.json'));
    const pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
    return {
      check: 'Has package.json',
      passed: true,
      detail: `Package: ${pkg.name || 'unnamed'} v${pkg.version || '0.0.0'}`,
    };
  } catch {
    return { check: 'Has package.json', passed: false, detail: 'No package.json found' };
  }
}

/**
 * Check 7: Has README.
 */
async function checkHasReadme(projectPath) {
  const readmes = ['README.md', 'README.txt', 'README'];
  for (const name of readmes) {
    try {
      await access(join(projectPath, name));
      return { check: 'Has README', passed: true, detail: `Found ${name}` };
    } catch { /* not found */ }
  }
  return { check: 'Has README', passed: false, detail: 'No README found' };
}

/**
 * Check 8: Has .gitignore.
 */
async function checkHasGitignore(projectPath) {
  try {
    await access(join(projectPath, '.gitignore'));
    return { check: 'Has .gitignore', passed: true, detail: 'Found .gitignore' };
  } catch {
    return { check: 'Has .gitignore', passed: false, detail: 'No .gitignore found' };
  }
}

/**
 * Check 9: Has license.
 */
async function checkHasLicense(projectPath) {
  const licenses = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE-MIT'];
  for (const name of licenses) {
    try {
      await access(join(projectPath, name));
      return { check: 'Has license', passed: true, detail: `Found ${name}` };
    } catch { /* not found */ }
  }
  return { check: 'Has license', passed: false, detail: 'No license file found' };
}

/**
 * Calculate approximate test coverage from test file presence.
 * @param {string} projectPath
 * @returns {Promise<{ coverage: number, sourceFiles: number, testFiles: number }>}
 */
export async function estimateCoverage(projectPath) {
  const srcDir = join(projectPath, 'src');
  let sourceFiles = 0;
  let testFiles = 0;

  try {
    await access(srcDir);
    const allFiles = await findFiles(srcDir, ['.js', '.ts', '.jsx', '.tsx']);

    for (const file of allFiles) {
      if (file.match(/\.(test|spec)\./)) {
        testFiles++;
      } else {
        sourceFiles++;
      }
    }
  } catch {
    // No src dir
  }

  const coverage = sourceFiles === 0 ? 100 : Math.round((testFiles / sourceFiles) * 100);
  return { coverage, sourceFiles, testFiles };
}

/**
 * Find files recursively by extension.
 * @param {string} dir
 * @param {string[]} extensions
 * @returns {Promise<string[]>}
 */
async function findFiles(dir, extensions) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('node_modules') && !entry.name.startsWith('.git')) {
      const sub = await findFiles(fullPath, extensions);
      results.push(...sub);
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

export default { runAllGates, estimateCoverage };
