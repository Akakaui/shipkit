#!/usr/bin/env node
/**
 * shipkit — Skill Format Converter
 *
 * Converts between SKILL.md formats for different AI coding agents.
 * The base format is the AAIF Agent Skills standard.
 * All shipkit skills ship in native SKILL.md format.
 *
 * @license MIT
 * @author Akakaui
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, basename, extname } from 'path';

const FORMATS = {
  'skm.md': {
    name: 'SKILL.md',
    extension: '.skill.md',
    description: 'Standard AAIF Agent Skills format',
  },
  md: {
    name: 'Markdown',
    extension: '.md',
    description: 'Plain markdown (legacy agents)',
  },
  json: {
    name: 'JSON Skill',
    extension: '.json',
    description: 'Structured JSON skill definition',
  },
};

/**
 * Convert a SKILL.md file to a target format.
 * @param {string} skillPath - Path to SKILL.md file
 * @param {string} targetFormat - 'skm.md', 'md', or 'json'
 * @param {string} outputDir - Output directory
 * @returns {Promise<string>} Path to converted file
 */
export async function convertSkill(skillPath, targetFormat, outputDir) {
  const content = await readFile(skillPath, 'utf-8');
  // Use the parent directory name as the skill name
  const name = basename(skillPath.replace(/\/SKILL\.md$/, ''));
  const format = FORMATS[targetFormat];

  if (!format) throw new Error(`Unknown target format: ${targetFormat}`);

  await mkdir(outputDir, { recursive: true });

  let output;
  let outputPath;

  switch (targetFormat) {
    case 'skm.md':
      // Already in SKILL.md format — just copy
      outputPath = join(outputDir, `${name}.skill.md`);
      await writeFile(outputPath, content);
      break;

    case 'md':
      // Strip frontmatter if present, keep content
      const plainMd = content.replace(/^---[\s\S]*?---\n*/, '');
      outputPath = join(outputDir, `${name}.md`);
      await writeFile(outputPath, plainMd);
      break;

    case 'json':
      // Parse frontmatter + body into structured JSON
      const parsed = parseSkillMd(content);
      outputPath = join(outputDir, `${name}.json`);
      await writeFile(outputPath, JSON.stringify(parsed, null, 2));
      break;
  }

  return outputPath;
}

/**
 * Convert all skills in a directory to a target format.
 * @param {string} sourceDir - Directory containing SKILL.md files
 * @param {string} targetFormat - Target format
 * @param {string} outputDir - Output directory
 */
export async function convertAll(sourceDir, targetFormat, outputDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(sourceDir, entry.name, 'SKILL.md');
    try {
      const result = await convertSkill(skillPath, targetFormat, outputDir);
      results.push(result);
    } catch {
      // Skip invalid skills
    }
  }

  return results;
}

/**
 * Parse a SKILL.md file into structured data.
 */
function parseSkillMd(content) {
  let frontmatter = {};
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const fmRaw = content.slice(3, end).trim();
      body = content.slice(end + 3).trim();
      frontmatter = parseYamlLike(fmRaw);
    }
  }

  return {
    name: frontmatter.name || 'untitled',
    description: frontmatter.description || '',
    triggers: frontmatter.triggers || [],
    metadata: frontmatter.metadata || {},
    body,
  };
}

/**
 * Minimal YAML-like frontmatter parser (handles common cases).
 */
function parseYamlLike(raw) {
  const result = {};
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('|')) {
      // Multiline — consume following indented lines
      value = '';
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    result[key] = value;
  }
  return result;
}

export { FORMATS };
