import * as fs from 'fs';
import * as path from 'path';

export interface VSCodeLaunchConfig {
    version: string;
    configurations: Array<{
        type: string;
        request: string;
        name: string;
        rootDir?: string;
        files?: string[];
        outDir?: string;
        stagingFolderPath?: string;
        sourceDirs?: string[];
        [key: string]: any;
    }>;
}

export interface BSConfig {
    stagingDir?: string;
    outDir?: string;
    rootDir?: string;
    files?: any[];
    [key: string]: any;
}

export interface BuildConfig {
    rootDir: string;
    outDir?: string;
    stagingFolderPath?: string;
    files?: string[];
    sourceDirs?: string[];
}

/**
 * Read and parse VSCode launch.json configuration
 */
export function readVSCodeConfig(projectRootDir: string): VSCodeLaunchConfig | null {
    const launchJsonPath = path.join(projectRootDir, '.vscode', 'launch.json');

    if (!fs.existsSync(launchJsonPath)) {
        return null;
    }

    try {
        // Read the file content
        const content = fs.readFileSync(launchJsonPath, 'utf8');

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
        console.error('Error parsing launch.json:', error);
        return null;
    }
}

/**
 * Read and parse bsconfig.json configuration
 */
export function readBSConfig(projectRootDir: string): BSConfig | null {
    const bsconfigPath = path.join(projectRootDir, 'bsconfig.json');

    if (!fs.existsSync(bsconfigPath)) {
        return null;
    }

    try {
        // Read the file content
        const content = fs.readFileSync(bsconfigPath, 'utf8');

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
        console.error('Error parsing bsconfig.json:', error);
        console.error('File path:', bsconfigPath);
        return null;
    }
}

/**
 * Extract build configuration from VSCode launch.json
 */
export function extractBuildConfig(projectRootDir: string): BuildConfig | null {
    const vsCodeConfig = readVSCodeConfig(projectRootDir);

    if (!vsCodeConfig || !vsCodeConfig.configurations) {
        return null;
    }

    // Find the first BrightScript configuration
    const brsConfig = vsCodeConfig.configurations.find(
        config => config.type === 'brightscript' || config.type === 'roku'
    );

    if (!brsConfig) {
        return null;
    }

    // Extract build configuration
    const buildConfig: BuildConfig = {
        rootDir: brsConfig.rootDir || projectRootDir,
        outDir: brsConfig.outDir,
        stagingFolderPath: brsConfig.stagingFolderPath,
        files: brsConfig.files,
        sourceDirs: brsConfig.sourceDirs
    };

    // Resolve paths relative to project root
    if (buildConfig.rootDir && !path.isAbsolute(buildConfig.rootDir)) {
        buildConfig.rootDir = path.join(projectRootDir, buildConfig.rootDir);
    }

    if (buildConfig.outDir && !path.isAbsolute(buildConfig.outDir)) {
        buildConfig.outDir = path.join(projectRootDir, buildConfig.outDir);
    }

    if (buildConfig.stagingFolderPath && !path.isAbsolute(buildConfig.stagingFolderPath)) {
        buildConfig.stagingFolderPath = path.join(projectRootDir, buildConfig.stagingFolderPath);
    }

    return buildConfig;
}

/**
 * Get the effective build directory from VSCode config or fallback
 */
export function getBuildDirectory(projectRootDir: string): string {
    // First check VSCode launch.json
    const buildConfig = extractBuildConfig(projectRootDir);

    if (buildConfig) {
        // Priority order: stagingFolderPath > outDir > rootDir
        if (buildConfig.stagingFolderPath && fs.existsSync(buildConfig.stagingFolderPath)) {
            return buildConfig.stagingFolderPath;
        }

        if (buildConfig.outDir && fs.existsSync(buildConfig.outDir)) {
            return buildConfig.outDir;
        }
    }

    // Check bsconfig.json
    const bsConfig = readBSConfig(projectRootDir);
    if (bsConfig) {
        if (bsConfig.stagingDir) {
            const stagingPath = path.isAbsolute(bsConfig.stagingDir)
                ? bsConfig.stagingDir
                : path.join(projectRootDir, bsConfig.stagingDir);

            if (fs.existsSync(stagingPath)) {
                return stagingPath;
            }
        }

        if (bsConfig.outDir) {
            const outPath = path.isAbsolute(bsConfig.outDir)
                ? bsConfig.outDir
                : path.join(projectRootDir, bsConfig.outDir);

            if (fs.existsSync(outPath)) {
                return outPath;
            }
        }
    }

    // Fallback to common build directories
    const commonBuildDirs = ['.build', 'dist', 'build', 'out', '.out'];
    for (const dir of commonBuildDirs) {
        const buildPath = path.join(projectRootDir, dir);
        if (fs.existsSync(buildPath)) {
            return buildPath;
        }
    }

    // Final fallback to project root
    return projectRootDir;
} 