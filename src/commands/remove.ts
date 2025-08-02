import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import chalk from 'chalk';

export function removeCommand(program: Command) {
    program
        .command('remove [project]')
        .description('Remove a project')
        .action(async (projectName?: string) => {
            const configManager = new ConfigManager();
            const projects = configManager.getProjects();

            if (projects.length === 0) {
                console.log(chalk.red('\nNo projects configured.\n'));
                return;
            }

            // Select project if not specified
            if (!projectName) {
                const { selectedProject } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedProject',
                        message: 'Select a project to remove:',
                        choices: projects.map(p => p.name)
                    }
                ]);
                projectName = selectedProject;
            }

            const project = configManager.getProject(projectName!);
            if (!project) {
                console.log(chalk.red(`\nProject '${projectName}' not found.\n`));
                return;
            }

            // Show project details before confirmation
            console.log(chalk.bold(`\n🗑️  Removing ${chalk.red(project.name)}\n`));
            console.log(chalk.gray('Project details:'));
            console.log(chalk.gray(`  Sign Key: ${project.signKey.substring(0, 8)}...`));
            console.log(chalk.gray(`  Package: ${project.signPackageLocation}`));
            console.log(chalk.gray(`  Output: ${project.outputLocation}\n`));

            // Confirm deletion
            const { confirmDelete } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmDelete',
                    message: `Are you sure you want to remove '${project.name}'?`,
                    default: false
                }
            ]);

            if (!confirmDelete) {
                console.log(chalk.yellow('\nRemoval cancelled.\n'));
                return;
            }

            const removed = configManager.removeProject(project.name);

            if (removed) {
                console.log(chalk.green(`\n✓ Project '${project.name}' removed successfully\n`));
            } else {
                console.log(chalk.red(`\nFailed to remove project '${project.name}'\n`));
            }
        });
} 