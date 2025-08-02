import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import { RokuDiscovery } from '../lib/roku-discovery';
import { RokuAPI } from '../lib/roku-api';
import chalk from 'chalk';
import ora from 'ora';
import { DiscoveredDevice, RokuDevice } from '../types';

export function discoverCommand(program: Command) {
    program
        .command('discover')
        .description('Discover Roku devices on the network and optionally configure one')
        .option('--configure', 'Configure a discovered device immediately')
        .option('--first-device', 'Automatically use the first discovered device (requires --configure)')
        .option('--password <password>', 'Provide the developer password (avoids interactive prompt)')
        .action(async (options) => {
            // Validate flag combinations
            if (options.firstDevice && !options.configure) {
                console.log(chalk.red('\nError: --first-device can only be used with --configure\n'));
                return;
            }

            console.log(chalk.bold('\n📡 Discovering Roku devices on the network...\n'));

            const spinner = ora('Scanning for Roku devices...').start();

            try {
                const devices = await RokuDiscovery.discoverDevices();
                spinner.stop();

                if (devices.length === 0) {
                    console.log(chalk.yellow('No Roku devices found on the network.'));
                    console.log(chalk.gray('\nTroubleshooting tips:'));
                    console.log(chalk.gray('• Make sure your Roku device is connected to the same network'));
                    console.log(chalk.gray('• Enable "Developer mode" on your Roku device'));
                    console.log(chalk.gray('• Check that ECP (External Control Protocol) is enabled'));
                    console.log(chalk.gray('• Try configuring the device manually with "roku-pkg device"\n'));
                    return;
                }

                console.log(chalk.green(`✓ Found ${devices.length} Roku device${devices.length === 1 ? '' : 's'}:\n`));

                // Display discovered devices
                devices.forEach((device, index) => {
                    console.log(chalk.cyan(`${index + 1}. ${device.name}`));
                    console.log(chalk.gray(`   IP: ${device.ip}`));
                    console.log(chalk.gray(`   Model: ${device.modelName}`));
                    console.log(chalk.gray(`   Serial: ${device.serialNumber}`));
                    if (device.softwareVersion) {
                        console.log(chalk.gray(`   Software: ${device.softwareVersion}`));
                    }
                    console.log();
                });

                // If configure option is provided, allow user to select and configure a device
                if (options.configure) {
                    await configureDiscoveredDevice(devices, options.firstDevice, options.password);
                } else {
                    console.log(chalk.blue('Use "roku-pkg discover --configure" to set up one of these devices.'));
                    console.log(chalk.blue('Or use "roku-pkg generate --discover" to select a device during package generation.\n'));
                }

            } catch (error: any) {
                spinner.fail('Discovery failed');
                console.log(chalk.red(`Error: ${error.message}\n`));
            }
        });
}

async function configureDiscoveredDevice(devices: DiscoveredDevice[], autoSelectFirst?: boolean, providedPassword?: string): Promise<void> {
    const configManager = new ConfigManager();

    let selectedDevice;

    // Auto-select first device if flag is provided
    if (autoSelectFirst) {
        selectedDevice = devices[0];
        console.log(chalk.blue(`🤖 Auto-selecting first device: ${selectedDevice.name} (${selectedDevice.ip})\n`));
    } else {
        // Let user select a device interactively
        const response = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedDevice',
                message: 'Select a device to configure:',
                choices: [
                    ...devices.map((device, index) => ({
                        name: `${device.name} (${device.ip}) - ${device.modelName}`,
                        value: device
                    })),
                    { name: chalk.gray('Cancel'), value: null }
                ]
            }
        ]);
        selectedDevice = response.selectedDevice;

        if (!selectedDevice) {
            console.log(chalk.gray('\nConfiguration cancelled.\n'));
            return;
        }
    }

    // Test device connectivity first
    const spinner = ora(`Testing connection to ${selectedDevice.name}...`).start();
    const isReachable = await RokuDiscovery.testDevice(selectedDevice);

    if (!isReachable) {
        spinner.fail(`Cannot connect to ${selectedDevice.name}`);
        console.log(chalk.red('Device is not reachable. Please check network connectivity.\n'));
        return;
    }

    spinner.succeed(`Connected to ${selectedDevice.name}`);

    // Get developer password
    let password = providedPassword;

    if (!password) {
        const response = await inquirer.prompt([
            {
                type: 'password',
                name: 'password',
                message: 'Enter the Roku developer password:',
                mask: '*',
                validate: (input) => input ? true : 'Password is required'
            }
        ]);
        password = response.password;
    } else {
        console.log(chalk.gray(`Using provided password for ${selectedDevice.name}`));
    }

        // Ensure password is available at this point
    if (!password) {
        console.log(chalk.red('Password is required but not provided.\n'));
        return;
    }

    // Test authentication
    const authSpinner = ora('Testing authentication...').start();
    try {
        const rokuApi = new RokuAPI(selectedDevice.ip, password);
        const authSuccess = await rokuApi.testConnection();
        
        if (!authSuccess) {
            authSpinner.fail('Authentication test failed');
            console.log(chalk.red('Unable to authenticate with the device. Please check your password.\n'));
            return;
        }

        authSpinner.succeed('Authentication successful');

        // Save device configuration
        const deviceConfig: RokuDevice = {
            ip: selectedDevice.ip,
            password: password,
            name: selectedDevice.name,
            modelName: selectedDevice.modelName,
            serialNumber: selectedDevice.serialNumber,
            softwareVersion: selectedDevice.softwareVersion
        };

        configManager.setRokuDevice(deviceConfig);

        console.log(chalk.green(`\n✓ Device "${selectedDevice.name}" configured successfully!\n`));
        console.log(chalk.blue('You can now use "roku-pkg generate" to build and deploy packages to this device.\n'));

    } catch (error: any) {
        authSpinner.fail('Authentication failed');
        console.log(chalk.red(`Error: ${error.message}\n`));
    }
}