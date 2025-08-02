import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface VSCodeTask {
    label: string;
    type: string;
    command?: string;
    script?: string;
    args?: string[];
    options?: {
        cwd?: string;
        env?: Record<string, string>;
    };
    group?: {
        kind: string;
        isDefault?: boolean;
    };
    problemMatcher?: any;
    dependsOn?: string | string[];
}

export interface VSCodeTasksConfig {
    version: string;
    tasks: VSCodeTask[];
}

/**
 * Read and parse VSCode tasks.json configuration
 */
export function readVSCodeTasks(projectRootDir: string): VSCodeTasksConfig | null {
    const tasksJsonPath = path.join(projectRootDir, '.vscode', 'tasks.json');

    if (!fs.existsSync(tasksJsonPath)) {
        return null;
    }

    try {
        // Read the file content
        const content = fs.readFileSync(tasksJsonPath, 'utf8');

        // Remove comments and trailing commas (more aggressive cleaning)
        let jsonContent = content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\/\/.*$/gm, ''); // Remove line comments

        // Remove trailing commas before ] or }
        jsonContent = jsonContent
            .replace(/,\s*\]/g, ']')  // Remove trailing comma before ]
            .replace(/,\s*\}/g, '}'); // Remove trailing comma before }

        // Parse JSON
        const config = JSON.parse(jsonContent);
        return config;
    } catch (error) {
        console.error('Error parsing tasks.json:', error);
        return null;
    }
}

/**
 * Get build-related tasks from tasks.json
 */
export function getBuildTasks(projectRootDir: string): VSCodeTask[] {
    const tasksConfig = readVSCodeTasks(projectRootDir);

    if (!tasksConfig || !tasksConfig.tasks) {
        return [];
    }

    // Filter tasks that are likely build tasks
    return tasksConfig.tasks.filter(task => {
        const label = task.label.toLowerCase();
        return label.includes('build') ||
            label.includes('compile') ||
            label.includes('package') ||
            label.includes('deploy') ||
            (task.group && task.group.kind === 'build');
    });
}

/**
 * Execute a VSCode task
 */
export async function executeTask(task: VSCodeTask, projectRootDir: string, timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
        let command: string;
        let args: string[] = [];

        if (task.type === 'npm' && task.script) {
            command = 'npm';
            args = ['run', task.script];
        } else if (task.type === 'shell' && task.command) {
            // Parse command and args
            const parts = task.command.split(' ');
            command = parts[0];
            args = parts.slice(1);

            if (task.args) {
                args = args.concat(task.args);
            }
        } else if (task.command) {
            command = task.command;
            args = task.args || [];
        } else {
            reject(new Error(`Cannot determine command for task: ${task.label}`));
            return;
        }

        const cwd = task.options?.cwd
            ? path.isAbsolute(task.options.cwd)
                ? task.options.cwd
                : path.join(projectRootDir, task.options.cwd)
            : projectRootDir;

        console.log(`Executing: ${command} ${args.join(' ')}`);
        console.log(`Working directory: ${cwd}`);

        const child = spawn(command, args, {
            cwd,
            env: { ...process.env, ...task.options?.env },
            stdio: 'inherit',
            shell: true
        });

        let timeoutId: NodeJS.Timeout | undefined;

        if (timeout) {
            timeoutId = setTimeout(() => {
                console.log(`\nTask timed out after ${timeout}ms. Killing process...`);
                child.kill('SIGTERM');
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, timeout);
        }

        child.on('close', (code) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (code === 0) {
                resolve();
            } else if (code === null) {
                reject(new Error(`Task "${task.label}" was terminated`));
            } else {
                reject(new Error(`Task "${task.label}" failed with exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            reject(err);
        });
    });
}

/**
 * Get all tasks from tasks.json
 */
export function getAllTasks(projectRootDir: string): VSCodeTask[] {
    const tasksConfig = readVSCodeTasks(projectRootDir);

    if (!tasksConfig || !tasksConfig.tasks) {
        return [];
    }

    return tasksConfig.tasks;
} 