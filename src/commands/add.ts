import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import chalk from 'chalk';
import * as path from 'path';
import { validatePackageFile } from '../utils/validators';

export function addCommand(program: Command) {
    program
        .command('add')
        .description('Add a new project')
        .action(async () => {
            const configManager = new ConfigManager();

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Project name:',
                    validate: (input) => {
                        if (!input) return 'Project name is required';
                        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                            return 'Project name can only contain letters, numbers, hyphens, and underscores';
                        }
                        if (configManager.getProject(input)) {
                            return 'Project already exists';
                        }
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'rootDir',
                    message: 'Root directory of Roku app source:',
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
                    validate: (input) => input ? true : 'Signing key is required'
                },
                {
                    type: 'input',
                    name: 'signPackageLocation',
                    message: 'Signed package location:',
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
                    default: (answers: any) => `./output/${answers.name}.pkg`,
                    filter: (input) => {
                        if (input.startsWith('~')) {
                            return path.join(process.env.HOME || '', input.slice(1));
                        }
                        return input;
                    }
                }
            ]);

            // Validate the package file exists (warning only)
            const validation = validatePackageFile(answers.signPackageLocation);
            if (!validation.valid) {
                console.log(chalk.yellow(`\n⚠️  Warning: ${validation.error}`));
                console.log(chalk.gray('  The package file will be required when generating packages.\n'));
            }

            configManager.addProject(answers);
            console.log(chalk.green(`\n✓ Project '${answers.name}' added successfully`));
            console.log(chalk.gray(`\nRun 'roku-pkg generate ${answers.name}' to build and create the package\n`));
        });
} 