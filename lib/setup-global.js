import { mkdir, copyFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

export async function setupGlobal() {
  console.log(chalk.cyan('\n🌍 Setting up CODE globally...\n'));

  const globalAgentsDir = join(homedir(), '.config', 'opencode', 'agents');
  const globalSkillsDir = join(homedir(), '.config', 'opencode', 'skills');
  const globalToolsDir = join(homedir(), '.config', 'opencode', 'tools');

  const codeAgentsDir = join(globalAgentsDir, 'code-system');
  const codeSkillsDir = join(globalSkillsDir, 'code-system');
  const codeToolsDir = join(join(globalToolsDir, 'code'));

  try {
    // Create directories
    await mkdir(codeAgentsDir, { recursive: true });
    await mkdir(codeSkillsDir, { recursive: true });
    await mkdir(codeToolsDir, { recursive: true });

    // Get template paths
    const __dirname = new URL('.', import.meta.url).pathname;
    const templateDir = resolve(__dirname, '..', 'templates');

    // Copy agents
    const agentsDir = join(templateDir, 'agents');
    const agentFiles = await readdir(agentsDir);
    for (const file of agentFiles) {
      await copyFile(
        join(agentsDir, file),
        join(codeAgentsDir, file)
      );
    }
    console.log(chalk.green(`✓ Installed ${agentFiles.length} agents`));

    // Copy skills
    const skillsDir = join(templateDir, 'skills');
    const skillFiles = await readdir(skillsDir);
    for (const file of skillFiles) {
      await copyFile(
        join(skillsDir, file),
        join(codeSkillsDir, file)
      );
    }
    console.log(chalk.green(`✓ Installed ${skillFiles.length} skills`));

    // Copy tools
    const toolsDir = join(templateDir, 'tools', 'code');
    const toolFiles = await readdir(toolsDir);
    for (const file of toolFiles) {
      await copyFile(
        join(toolsDir, file),
        join(codeToolsDir, file)
      );
    }
    console.log(chalk.green(`✓ Installed ${toolFiles.length} tools`));

    console.log(chalk.cyan('\n✅ Global installation complete!'));
    console.log(chalk.gray('\nAgents and skills are now available in all your projects.'));

  } catch (error) {
    console.error(chalk.red('Failed to install globally:'), error.message);
    throw error;
  }
}