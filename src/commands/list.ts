import { Command } from 'commander';
import { ConfigManager } from '../lib/config-manager';
import chalk from 'chalk';

export function listCommand(program: Command) {
    program
        .command('list')
        .description('List all configured projects')
        .action(() => {
            const configManager = new ConfigManager();
            const projects = configManager.getProjects();
            const device = configManager.getRokuDevice();

            // Show device info
            console.log(chalk.bold('\n📺 Roku Device:'));
            if (device.ip) {
                console.log(`   IP: ${chalk.cyan(device.ip)}`);
                console.log(`   Password: ${chalk.gray('****')}\n`);
            } else {
                console.log(chalk.yellow('   Not configured\n'));
            }

            // Show projects
            console.log(chalk.bold('📦 Projects:'));
            if (projects.length === 0) {
                console.log(chalk.yellow('   No projects configured yet.\n'));
                return;
            }

            projects.forEach((project, index) => {
                console.log(`\n${index + 1}. ${chalk.green(project.name)}`);
                if (project.rootDir) {
                    console.log(`   Root Dir: ${chalk.gray(project.rootDir)}`);
                } else {
                    console.log(`   Root Dir: ${chalk.red('Not configured')}`);
                }
                console.log(`   Sign Key: ${chalk.gray(project.signKey.substring(0, 8) + '...')}`);
                console.log(`   Package: ${chalk.gray(project.signPackageLocation)}`);
                console.log(`   Output: ${chalk.gray(project.outputLocation)}`);
            });
            console.log();
        });
} 