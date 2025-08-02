import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../lib/config-manager';
import { RokuDeployManager } from '../lib/roku-deploy';
import { RokuDiscovery } from '../lib/roku-discovery';
import { RokuAPI } from '../lib/roku-api';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirectoryExists } from '../utils/validators';
import { getBuildDirectory, extractBuildConfig, readBSConfig } from '../utils/vscode-config';
import { getBuildTasks, executeTask, getAllTasks } from '../utils/vscode-tasks';
import axios from 'axios';
import { DiscoveredDevice, RokuDevice } from '../types';

export function generateCommand(program: Command) {
    program
        .command('generate [project]')
        .description('Build, deploy, and generate a package for a project')
        .option('--skip-build', 'Skip the build step')
        .option('--skip-rekey', 'Skip device rekeying')
        .option('--package-only', 'Create package without deployment (requires app already on device)')
        .option('--build-task <task>', 'Specify a build task to run')
        .option('--use-existing-build', 'Use existing build without running any tasks')
        .option('--discover', 'Discover and select a Roku device before processing')
        .option('--first-device', 'Automatically use the first discovered device (requires --discover)')
        .option('--password <password>', 'Provide the developer password (avoids interactive prompt)')
        .action(async (projectName?: string, options?: any) => {
            // Validate flag combinations
            if (options?.firstDevice && !options?.discover) {
                console.log(chalk.red('\nError: --first-device can only be used with --discover\n'));
                return;
            }

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
                        message: 'Select a project:',
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

            let device = configManager.getRokuDevice();

            // If discover option is provided, run device discovery first
            if (options?.discover) {
                const discoveredDevice = await discoverAndSelectDevice(options?.firstDevice, options?.password);
                if (!discoveredDevice) {
                    console.log(chalk.red('\nNo device selected. Process cancelled.\n'));
                    return;
                }
                device = discoveredDevice;
            } else if (!device.ip || !device.password) {
                console.log(chalk.red('\nRoku device not configured. Use "roku-pkg device" or "roku-pkg generate --discover".\n'));
                return;
            }

            const spinner = ora();
            const deployManager = new RokuDeployManager();

            try {

                console.log(chalk.cyan(`\n🚀 Generating package for ${projectName}\n`));

                // Always send device to home screen first
                try {
                    spinner.start('Sending device to home screen...');
                    // Use keypress/home command to send device to home
                    const homeResponse = await axios.post(
                        `http://${device.ip}:8060/keypress/home`,
                        undefined,  // No body at all
                        {
                            timeout: 5000,
                            validateStatus: () => true  // Accept any status
                        }
                    );

                    if (homeResponse.status === 200 || homeResponse.status === 202) {
                        spinner.succeed('Device sent to home screen');
                        // Give device a moment to return to home
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else if (homeResponse.status === 403) {
                        // Some devices might have ECP disabled or restricted
                        spinner.warn('ECP access restricted on device, continuing anyway...');
                        console.log(chalk.yellow('  Enable ECP on your Roku device for better reliability'));
                    } else {
                        spinner.warn(`Home command returned status ${homeResponse.status}, continuing anyway...`);
                    }
                } catch (homeError: any) {
                    spinner.warn('Could not send device to home screen, continuing anyway...');
                    if (homeError.code === 'ECONNREFUSED') {
                        console.log(chalk.gray('  ECP service might be disabled on the device'));
                    } else {
                        console.log(chalk.gray(`  ${homeError.message || homeError}`));
                    }
                }

                // Check if we should skip build
                if (!options?.skipBuild) {
                    spinner.text = 'Checking for build tasks...';

                    // Check if build directory already exists
                    const buildDir = getBuildDirectory(project.rootDir);
                    const buildExists = fs.existsSync(buildDir) && fs.existsSync(path.join(buildDir, 'manifest'));

                    // If use-existing-build flag is provided, skip task selection
                    if (options?.useExistingBuild) {
                        if (buildExists) {
                            console.log(chalk.green('\n✓ Using existing build directory\n'));
                            spinner.start('Continuing with deployment...');
                        } else {
                            console.log(chalk.red('\nNo existing build found. Cannot use --use-existing-build.\n'));
                            return;
                        }
                    } else {
                        const buildTasks = getBuildTasks(project.rootDir);
                        const allTasks = getAllTasks(project.rootDir);

                        if (buildTasks.length > 0 || allTasks.length > 0) {
                            spinner.stop();

                            let selectedTask;

                            if (options?.buildTask) {
                                // Use specified task
                                selectedTask = allTasks.find(t => t.label === options.buildTask);
                                if (!selectedTask) {
                                    console.log(chalk.red(`\nTask "${options.buildTask}" not found.\n`));
                                    console.log(chalk.yellow('Available tasks:'));
                                    allTasks.forEach(task => {
                                        console.log(chalk.gray(`  - ${task.label}`));
                                    });
                                    console.log();
                                    return;
                                }
                                console.log(chalk.blue(`\nUsing specified task: ${selectedTask.label}\n`));
                            } else {
                                // Show task selection
                                console.log(chalk.yellow('\nAvailable build tasks:'));

                                const taskChoices = [
                                    ...buildTasks.map(task => ({
                                        name: `${task.label} ${chalk.gray(`(${task.type})`)}`,
                                        value: task
                                    })),
                                    { name: chalk.gray('Skip build'), value: null }
                                ];

                                // If build already exists, add option to use existing build
                                if (buildExists) {
                                    taskChoices.unshift({
                                        name: chalk.green('Use existing build'),
                                        value: 'use-existing' as any
                                    });
                                }

                                // If there are other non-build tasks, offer to show them
                                if (allTasks.length > buildTasks.length) {
                                    taskChoices.splice(-1, 0, {
                                        name: chalk.blue('Show all tasks...'),
                                        value: 'show-all' as any
                                    });
                                }

                                const { task } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'task',
                                        message: 'Select a build task to run:',
                                        choices: taskChoices
                                    }
                                ]);

                                if (task === 'use-existing') {
                                    console.log(chalk.green('\nUsing existing build directory\n'));
                                    spinner.start('Continuing with deployment...');
                                } else if (task === 'show-all') {
                                    // Show all tasks
                                    const { allTask } = await inquirer.prompt([
                                        {
                                            type: 'list',
                                            name: 'allTask',
                                            message: 'Select any task to run:',
                                            choices: [
                                                ...allTasks.map(t => ({
                                                    name: `${t.label} ${chalk.gray(`(${t.type})`)}`,
                                                    value: t
                                                })),
                                                { name: chalk.gray('Skip build'), value: null }
                                            ]
                                        }
                                    ]);
                                    selectedTask = allTask;
                                } else {
                                    selectedTask = task;
                                }
                            }

                            if (selectedTask) {
                                console.log(chalk.blue(`\nRunning task: ${selectedTask.label}\n`));
                                console.log(chalk.gray('Note: Build tasks may take several minutes to complete...\n'));

                                try {
                                    // Use a 5-minute timeout for build tasks
                                    await executeTask(selectedTask, project.rootDir, 300000);
                                    console.log(chalk.green(`\n✓ Task "${selectedTask.label}" completed successfully\n`));
                                } catch (error: any) {
                                    console.error(chalk.red(`\n✗ Task failed: ${error.message}\n`));

                                    if (error.message.includes('timed out')) {
                                        console.log(chalk.yellow('Tips:'));
                                        console.log('- Build tasks can take a long time, especially for large projects');
                                        console.log('- Try running the build manually first: cd to project and run the build command');
                                        console.log('- Once built, you can use --skip-build option\n');
                                    }
                                    return;
                                }
                            }

                            spinner.succeed('Task completed successfully');

                            // Add delay after build to ensure files are fully written
                            console.log(chalk.gray('\nWaiting for build output to be ready...'));
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

                            spinner.start('Continuing with deployment...');
                        } else {
                            console.log(chalk.gray('\nNo build tasks found or all builds completed.\n'));
                            spinner.start('Continuing with deployment...');
                        }
                    }


                } else {
                    console.log(chalk.gray('\nSkipping build step (--skip-build option used)\n'));
                }

                // Check for VSCode launch.json configuration
                spinner.text = 'Reading project configuration...';
                const buildConfig = extractBuildConfig(project.rootDir);
                const buildDir = getBuildDirectory(project.rootDir);

                console.log(chalk.gray(`\nUsing build directory: ${buildDir}`));

                if (buildConfig && buildDir !== project.rootDir) {
                    console.log(chalk.gray(`Found VSCode configuration in .vscode/launch.json`));
                }

                // Validate the build directory
                const validation = deployManager.validateProject(buildDir);
                if (!validation.valid) {
                    spinner.fail('Project validation failed');
                    console.log(chalk.red('\nProject structure errors:'));
                    validation.errors.forEach(error => {
                        console.log(chalk.red(`  - ${error}`));
                    });
                    console.log(chalk.yellow('\nMake sure your project is built before running this command.'));
                    return;
                }

                // Check if signed package exists
                if (!fs.existsSync(project.signPackageLocation)) {
                    spinner.fail(`Signed package not found: ${project.signPackageLocation}`);
                    console.log(chalk.yellow('\nTips:'));
                    console.log('- Check that the signed package file exists at the specified location');
                    console.log('- Ensure the path is correct and the file is readable');
                    console.log(`- You can edit the project with: roku-pkg edit ${project.name}\n`);
                    return;
                }

                // Ensure output directory exists
                const outputDir = path.dirname(project.outputLocation);
                ensureDirectoryExists(outputDir);

                // Step 3: Rekey the device first
                if (!options?.skipRekey) {
                    spinner.text = 'Rekeying device with project signing credentials...';

                    try {
                        await deployManager.rekeyDevice({
                            host: device.ip,
                            password: device.password,
                            rekeySignedPackage: project.signPackageLocation,
                            signingPassword: project.signKey
                        });

                        spinner.succeed('Device rekeyed successfully');
                        console.log(chalk.gray(`Rekeyed with package: ${project.signPackageLocation}`));

                        // Give the device time to process the rekey operation
                        console.log(chalk.gray('\nWaiting for device to be ready after rekeying...'));
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                    } catch (rekeyError: any) {
                        spinner.fail('Failed to rekey device');
                        console.error(chalk.red(`\nRekey Error: ${rekeyError.message}\n`));

                        console.log(chalk.yellow('Tips:'));
                        console.log('- Verify the signing key matches the signed package');
                        console.log('- Ensure the signed package was created with this signing key');
                        console.log('- Check that the package file is not corrupted');
                        console.log(`- You can edit the project with: roku-pkg edit ${project.name}\n`);
                        return;
                    }
                } else {
                    console.log(chalk.yellow('\nSkipping device rekeying (--skip-rekey option used)'));
                    console.log(chalk.gray('This assumes the device is already keyed with the correct signing credentials\n'));
                }

                // Step 4: Deploy and create signed package
                spinner.start('Building, deploying, and creating signed package...');

                // For deployment, we simply use everything in the build directory
                // The build process has already created the correct structure
                const files = [
                    '**/*'  // Include everything in the build directory
                ];

                console.log(chalk.gray(`\nDeploying from build directory: ${buildDir}`));
                console.log(chalk.gray('Including all files in the build output\n'));

                let packagePath: string;

                // Check if package-only option is set
                if (options?.packageOnly) {
                    spinner.text = 'Creating package from already deployed app...';
                    console.log(chalk.yellow('\nSkipping deployment (--package-only option used)'));
                    console.log(chalk.gray('This assumes the app is already deployed on the device\n'));

                    try {
                        packagePath = await deployManager.createPackage({
                            host: device.ip,
                            password: device.password,
                            rootDir: buildDir,
                            files: files,
                            signingPassword: project.signKey,
                            outFile: path.basename(project.outputLocation, '.pkg')
                        });

                        spinner.succeed('Package created successfully');
                    } catch (error: any) {
                        spinner.fail('Failed to create package');
                        console.error(chalk.red(`\nError: ${error.message}\n`));
                        return;
                    }
                } else {
                    // Full deployment
                    // Use longer timeout if we just built (device might need more time)
                    const deploymentTimeout = options?.skipBuild ? 180000 : 300000; // 3 minutes if skip-build, 5 minutes after fresh build

                    try {
                        // Set up heartbeat logging for long deployments
                        let heartbeatCount = 0;
                        const heartbeatInterval = setInterval(() => {
                            heartbeatCount++;
                            console.log(chalk.gray(`  ... still deploying (${heartbeatCount * 10}s elapsed)`));
                        }, 10000); // Log every 10 seconds

                        packagePath = await Promise.race([
                            deployManager.deployAndSignPackage({
                                host: device.ip,
                                password: device.password,
                                rootDir: buildDir,  // Use the build directory
                                files: files,
                                signingPassword: project.signKey,
                                // Don't pass rekeySignedPackage here since we already rekeyed
                                outFile: path.basename(project.outputLocation, '.pkg'),
                                retainStagingFolder: false
                            }).finally(() => clearInterval(heartbeatInterval)),
                            new Promise<never>((_, reject) =>
                                setTimeout(() => {
                                    clearInterval(heartbeatInterval);
                                    reject(new Error('Deployment timed out after 5 minutes'));
                                }, deploymentTimeout)
                            )
                        ]);
                    } catch (timeoutError: any) {
                        spinner.fail('Deployment timed out or failed');

                        if (timeoutError.message.includes('timed out')) {
                            console.log(chalk.yellow('\nThe deployment process is taking too long. This can happen with large projects.'));
                            console.log(chalk.yellow('\nSuggestions:'));
                            console.log('1. Build your project manually first, then use --skip-build option');
                            console.log('2. Check if your Roku device is responding (try accessing http://' + device.ip + ' in a browser)');
                            console.log('3. The gotham project may be too large for automated deployment\n');

                            // Offer to try the simpler deployment approach
                            const { trySimple } = await inquirer.prompt([{
                                type: 'confirm',
                                name: 'trySimple',
                                message: 'Would you like to create a package without deployment (requires app already on device)?',
                                default: true
                            }]);

                            if (trySimple) {
                                console.log('\nAttempting to create package from already deployed app...');
                                spinner.start('Creating package from deployed app...');
                                packagePath = await deployManager.createPackage({
                                    host: device.ip,
                                    password: device.password,
                                    rootDir: buildDir,
                                    files: files,
                                    signingPassword: project.signKey,
                                    outFile: path.basename(project.outputLocation, '.pkg')
                                });
                            } else {
                                console.log('\nExiting. Try using --skip-build or --package-only options.');
                                process.exit(1);
                            }
                        } else {
                            throw timeoutError;
                        }
                    }
                }

                // Step 5: Move package to desired location if needed
                if (packagePath && packagePath !== project.outputLocation) {
                    spinner.text = 'Moving package to output location...';

                    // Copy the file to the desired location
                    fs.copyFileSync(packagePath, project.outputLocation);

                    // Remove the original if it's in a different location
                    if (path.dirname(packagePath) !== path.dirname(project.outputLocation)) {
                        fs.unlinkSync(packagePath);
                    }

                    packagePath = project.outputLocation;
                }

                // Get file size
                const stats = fs.statSync(project.outputLocation);
                const sizeKB = (stats.size / 1024).toFixed(2);

                spinner.succeed(`Package generated successfully!`);
                console.log(chalk.gray(`\n📦 Package: ${project.outputLocation}`));
                console.log(chalk.gray(`📏 Size: ${sizeKB} KB\n`));

                // Send device back to home screen as cleanup
                try {
                    const homeSpinner = ora('Sending device to home screen...').start();
                    const homeResponse = await axios.post(
                        `http://${device.ip}:8060/keypress/home`,
                        undefined,
                        {
                            timeout: 5000,
                            validateStatus: () => true
                        }
                    );

                    if (homeResponse.status === 200 || homeResponse.status === 202) {
                        homeSpinner.succeed('Device sent to home screen');
                    } else if (homeResponse.status === 403) {
                        homeSpinner.warn('ECP access restricted, but package completed successfully');
                    } else {
                        homeSpinner.warn(`Home command returned status ${homeResponse.status}, but package completed successfully`);
                    }
                } catch (homeError: any) {
                    console.log(chalk.yellow('⚠ Could not send device to home screen (package still completed successfully)'));
                    if (homeError.code === 'ECONNREFUSED') {
                        console.log(chalk.gray('  ECP service might be disabled on the device'));
                    } else if (homeError.message && !homeError.message.includes('timeout')) {
                        console.log(chalk.gray(`  ${homeError.message}`));
                    }
                }

                // Ensure the process exits cleanly
                process.exit(0);
            } catch (error: any) {
                if (spinner && spinner.isSpinning) {
                    spinner.fail(`Failed to generate package`);
                }
                console.error(chalk.red(`\nError: ${error.message}\n`));

                if (error.message.includes('ECONNREFUSED')) {
                    console.log(chalk.yellow('Tips:'));
                    console.log('- Make sure your Roku device is on the same network');
                    console.log('- Check that developer mode is enabled on your Roku');
                    console.log('- Verify the IP address is correct\n');
                } else if (error.message.includes('Authentication failed') || error.message.includes('401')) {
                    console.log(chalk.yellow('Tips:'));
                    console.log('- Check your Roku developer password');
                    console.log('- Update device settings with: roku-pkg device\n');
                } else if (error.message.includes('signing')) {
                    console.log(chalk.yellow('Tips:'));
                    console.log('- The device may need to be rekeyed again');
                    console.log('- Verify the signing key is correct');
                    console.log('- Ensure the signed package matches the signing key');
                    console.log(`- You can edit the project with: roku-pkg edit ${project.name}\n`);
                }
            }
        });
}

/**
 * Discover devices and let user select one for the current session
 */
async function discoverAndSelectDevice(autoSelectFirst?: boolean, providedPassword?: string): Promise<RokuDevice | null> {
    console.log(chalk.cyan('\n🔍 Discovering Roku devices...\n'));

    const spinner = ora('Scanning for Roku devices...').start();

    try {
        const devices = await RokuDiscovery.discoverDevices();
        spinner.stop();

        if (devices.length === 0) {
            console.log(chalk.yellow('No Roku devices found on the network.'));
            console.log(chalk.gray('\nTroubleshooting tips:'));
            console.log(chalk.gray('• Make sure your Roku device is connected to the same network'));
            console.log(chalk.gray('• Enable "Developer mode" on your Roku device'));
            console.log(chalk.gray('• Try using "roku-pkg device" to configure manually\n'));
            return null;
        }

        console.log(chalk.green(`✓ Found ${devices.length} Roku device${devices.length === 1 ? '' : 's'}\n`));

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
                    message: 'Select a device for package generation:',
                    choices: [
                        ...devices.map((device) => ({
                            name: `${device.name} (${device.ip}) - ${device.modelName}`,
                            value: device
                        })),
                        { name: chalk.gray('Cancel'), value: null }
                    ]
                }
            ]);
            selectedDevice = response.selectedDevice;

            if (!selectedDevice) {
                return null;
            }
        }

        // Test device connectivity
        const testSpinner = ora(`Testing connection to ${selectedDevice.name}...`).start();
        const isReachable = await RokuDiscovery.testDevice(selectedDevice);

        if (!isReachable) {
            testSpinner.fail(`Cannot connect to ${selectedDevice.name}`);
            console.log(chalk.red('Device is not reachable. Please check network connectivity.\n'));
            return null;
        }

        testSpinner.succeed(`Connected to ${selectedDevice.name}`);

        // Get developer password
        let password = providedPassword;
        let rememberDevice = false;

        if (!password) {
            // Interactive prompt for password and save option
            const response = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'password',
                    message: `Enter the developer password for ${selectedDevice.name}:`,
                    mask: '*',
                    validate: (input) => input ? true : 'Password is required'
                },
                {
                    type: 'confirm',
                    name: 'rememberDevice',
                    message: 'Save this device configuration for future use?',
                    default: true
                }
            ]);
            password = response.password;
            rememberDevice = response.rememberDevice;
        } else {
            console.log(chalk.gray(`Using provided password for ${selectedDevice.name}`));
            // When password is provided via flag, default to not saving unless explicitly requested
            rememberDevice = false;
        }

        // Ensure password is available at this point
        if (!password) {
            console.log(chalk.red('Password is required but not provided.\n'));
            return null;
        }

        // Test authentication
        const authSpinner = ora('Testing authentication...').start();
        try {
            const rokuApi = new RokuAPI(selectedDevice.ip, password);
            const authSuccess = await rokuApi.testConnection();

            if (!authSuccess) {
                authSpinner.fail('Authentication test failed');
                console.log(chalk.red('Unable to authenticate with the device. Please check your password.\n'));
                return null;
            }

            authSpinner.succeed('Authentication successful');

            const deviceConfig: RokuDevice = {
                ip: selectedDevice.ip,
                password: password,
                name: selectedDevice.name,
                modelName: selectedDevice.modelName,
                serialNumber: selectedDevice.serialNumber,
                softwareVersion: selectedDevice.softwareVersion
            };

            // Save device if user requested
            if (rememberDevice) {
                const configManager = new ConfigManager();
                configManager.setRokuDevice(deviceConfig);
                console.log(chalk.green(`✓ Device "${selectedDevice.name}" saved for future use`));
            }

            console.log(chalk.blue(`\nUsing device: ${selectedDevice.name} (${selectedDevice.ip})\n`));
            return deviceConfig;

        } catch (error: any) {
            authSpinner.fail('Authentication failed');
            console.log(chalk.red(`Error: ${error.message}\n`));
            return null;
        }

    } catch (error: any) {
        spinner.fail('Discovery failed');
        console.log(chalk.red(`Error: ${error.message}\n`));
        return null;
    }
} 