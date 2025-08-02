import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import chalk from 'chalk';
import * as path from 'path';

export function editCommand(program: Command) {
    program
        .command('edit [project]')
        .description('Edit a project configuration')
        .action(async (projectName?: string) => {
            const configManager = new ConfigManager();
            const projects = configManager.getProjects();

            if (projects.length === 0) {
                console.log(chalk.red('\nNo projects configured. Use "roku-pkg add" first.\n'));
                return;
            }

            // Select project if not specified
            if (!projectName) {
                const { selectedProject } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedProject',
                        message: 'Select a project to edit:',
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

            console.log(chalk.bold(`\n✏️  Editing ${chalk.cyan(project.name)}\n`));

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Project name:',
                    default: project.name,
                    validate: (input) => {
                        if (!input) return 'Project name is required';
                        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                            return 'Project name can only contain letters, numbers, hyphens, and underscores';
                        }
                        // Check if new name conflicts with another project
                        if (input !== project.name && configManager.getProject(input)) {
                            return 'A project with this name already exists';
                        }
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'rootDir',
                    message: 'Root directory of Roku app source:',
                    default: project.rootDir || '',
                    validate: (input) => input ? true : 'Root directory is required',
                    filter: (input) => {
                        // Expand ~ to home directory
                        if (input.startsWith('~')) {
                            return path.join(process.env.HOME || '', input.slice(1));
                        }
                        // Convert relative paths to absolute
                        if (!path.isAbsolute(input)) {
                            return path.resolve(input);
                        }
                        return input;
                    }
                },
                {
                    type: 'input',
                    name: 'signKey',
                    message: 'Signing key:',
                    default: project.signKey,
                    validate: (input) => input ? true : 'Signing key is required'
                },
                {
                    type: 'input',
                    name: 'signPackageLocation',
                    message: 'Signed package location:',
                    default: project.signPackageLocation,
                    validate: (input) => input ? true : 'Package location is required',
                    filter: (input) => {
                        // Expand ~ to home directory
                        if (input.startsWith('~')) {
                            return path.join(process.env.HOME || '', input.slice(1));
                        }
                        return input;
                    }
                },
                {
                    type: 'input',
                    name: 'outputLocation',
                    message: 'Output location:',
                    default: project.outputLocation,
                    filter: (input) => {
                        if (input.startsWith('~')) {
                            return path.join(process.env.HOME || '', input.slice(1));
                        }
                        return input;
                    }
                }
            ]);

            // If the name changed, remove the old project and add the new one
            if (answers.name !== project.name) {
                configManager.removeProject(project.name);
                configManager.addProject(answers);
            } else {
                configManager.updateProject(project.name, answers);
            }

            console.log(chalk.green(`\n✓ Project '${answers.name}' updated successfully\n`));
        });
} 