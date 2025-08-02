import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import chalk from 'chalk';

export function deviceCommand(program: Command) {
    program
        .command('device')
        .description('Configure Roku device settings')
        .action(async () => {
            const configManager = new ConfigManager();
            const currentDevice = configManager.getRokuDevice();

            console.log(chalk.bold('\n📺 Configure Roku Device\n'));

            // Show current device info if available
            if (currentDevice.ip) {
                console.log(chalk.cyan('Current device configuration:'));
                console.log(chalk.gray(`  IP: ${currentDevice.ip}`));
                if (currentDevice.name) {
                    console.log(chalk.gray(`  Name: ${currentDevice.name}`));
                }
                if (currentDevice.modelName) {
                    console.log(chalk.gray(`  Model: ${currentDevice.modelName}`));
                }
                if (currentDevice.serialNumber) {
                    console.log(chalk.gray(`  Serial: ${currentDevice.serialNumber}`));
                }
                console.log();
            }

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'ip',
                    message: 'Roku device IP address:',
                    default: currentDevice.ip,
                    validate: (input) => {
                        if (!input) return 'IP address is required';
                        // Basic IP validation
                        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                        if (!ipRegex.test(input)) {
                            return 'Please enter a valid IP address';
                        }
                        return true;
                    }
                },
                {
                    type: 'password',
                    name: 'password',
                    message: 'Roku developer password:',
                    mask: '*',
                    validate: (input) => input ? true : 'Password is required'
                }
            ]);

            configManager.setRokuDevice(answers);
            console.log(chalk.green('\n✓ Roku device configuration saved\n'));
        });
} 