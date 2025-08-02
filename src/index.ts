#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { listCommand } from './commands/list';
import { addCommand } from './commands/add';
import { deviceCommand } from './commands/device';
import { discoverCommand } from './commands/discover';
import { generateCommand } from './commands/generate';
import { editCommand } from './commands/edit';
import { removeCommand } from './commands/remove';

const program = new Command();

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

program
    .name('roku-pkg')
    .description('Roku Package Management CLI')
    .version(packageJson.version);

// Add all commands
listCommand(program);
addCommand(program);
deviceCommand(program);
discoverCommand(program);
generateCommand(program);
editCommand(program);
removeCommand(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    console.log(chalk.bold('\n🎮 Roku Package CLI\n'));
    program.outputHelp();
    console.log(chalk.gray('\nExample usage:'));
    console.log(chalk.gray('  roku-pkg discover      # Discover Roku devices'));
    console.log(chalk.gray('  roku-pkg device        # Configure Roku device'));
    console.log(chalk.gray('  roku-pkg add           # Add a new project'));
    console.log(chalk.gray('  roku-pkg list          # List all projects'));
    console.log(chalk.gray('  roku-pkg generate      # Generate a package\n'));
} 