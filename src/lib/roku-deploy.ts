import * as rokuDeploy from 'roku-deploy';
import * as fs from 'fs';
import * as path from 'path';

export interface RokuDeployOptions {
    host: string;
    password: string;
    rootDir: string;
    files?: string[];
    username?: string;
    signingPassword?: string;
    rekeySignedPackage?: string;
    devId?: string;
    outFile?: string;
    outDir?: string;
    retainStagingFolder?: boolean;
}

export class RokuDeployManager {

    /**
     * Build and deploy an app to Roku device
     */
    async deploy(options: RokuDeployOptions): Promise<void> {
        const deployOptions: any = {
            host: options.host,
            password: options.password,
            username: options.username || 'rokudev',
            rootDir: options.rootDir,
            files: options.files || [
                'source/**/*',
                'components/**/*',
                'images/**/*',
                'manifest'
            ],
            retainStagingFolder: options.retainStagingFolder || false,
            outFile: 'app.zip'
        };

        console.log('Deploying with options:', {
            host: deployOptions.host,
            rootDir: deployOptions.rootDir,
            files: deployOptions.files.length + ' patterns'
        });

        await rokuDeploy.deploy(deployOptions);
    }

    /**
     * Build, deploy, and create a signed package
     */
    async deployAndSignPackage(options: RokuDeployOptions): Promise<string> {
        const deployOptions: any = {
            host: options.host,
            password: options.password,
            username: options.username || 'rokudev',
            rootDir: options.rootDir,
            files: options.files || [
                'source/**/*',
                'components/**/*',
                'images/**/*',
                'manifest'
            ],
            signingPassword: options.signingPassword,
            rekeySignedPackage: options.rekeySignedPackage,
            devId: options.devId,
            outFile: options.outFile || 'app',
            retainStagingFolder: options.retainStagingFolder || false
        };



        try {
            console.log('Calling rokuDeploy.deployAndSignPackage...');
            console.log('Deploy options:', JSON.stringify({
                host: deployOptions.host,
                rootDir: deployOptions.rootDir,
                files: deployOptions.files ? deployOptions.files.length + ' patterns' : 'default',
                retainStagingFolder: deployOptions.retainStagingFolder,
                outFile: deployOptions.outFile
            }, null, 2));

            // Add progress tracking
            const startTime = Date.now();
            console.log('Starting deployment at:', new Date().toISOString());

            const result = await rokuDeploy.deployAndSignPackage(deployOptions);

            const endTime = Date.now();
            console.log('Deployment completed in:', (endTime - startTime) / 1000, 'seconds');


            return result;
        } catch (error: any) {
            console.error('deployAndSignPackage error:', error);
            console.error('Error occurred at:', new Date().toISOString());
            throw error;
        }
    }

    /**
     * Rekey a Roku device
     */
    async rekeyDevice(options: {
        host: string;
        password: string;
        rekeySignedPackage: string;
        signingPassword: string;
        devId?: string;
    }): Promise<void> {
        const rekeyOptions: any = {
            host: options.host,
            password: options.password,
            rekeySignedPackage: options.rekeySignedPackage,
            signingPassword: options.signingPassword,
            devId: options.devId
        };



        try {
            await rokuDeploy.rekeyDevice(rekeyOptions);

        } catch (error: any) {

            throw error;
        }
    }

    /**
     * Create a signed package without deploying
     */
    async createPackage(options: RokuDeployOptions): Promise<string> {
        // First create a zip package

        const zipPath = await this.zipPackage({
            rootDir: options.rootDir,
            files: options.files,
            outFile: options.outFile,
            outDir: options.outDir || './out'  // Use ./out instead of ./build
        });

        console.log('Zip created, now creating signed package from it...');

        // Then sign the package
        const packageOptions: any = {
            host: options.host,
            password: options.password,
            username: options.username || 'rokudev',
            signingPassword: options.signingPassword,
            outFile: options.outFile || 'app',
            retainStagingFolder: options.retainStagingFolder || false,
            stagingDir: path.dirname(zipPath),
            // Provide the rootDir to ensure roku-deploy knows where the files are
            rootDir: options.rootDir
        };



        try {
            // Use publish method which signs the already deployed app
            const result = await rokuDeploy.publish(packageOptions);


            // Look for the created package
            const pkgPath = path.join(packageOptions.stagingDir || './out', packageOptions.outFile + '.pkg');
            if (fs.existsSync(pkgPath)) {
                return pkgPath;
            }

            // Try alternate location
            const altPath = path.join('./out', packageOptions.outFile + '.pkg');
            if (fs.existsSync(altPath)) {
                return altPath;
            }

            throw new Error('Package was created but could not be found');
        } catch (error: any) {
            console.error('Error creating package:', error);
            throw error;
        }
    }

    /**
     * Build a zip file without deploying
     */
    async zipPackage(options: {
        rootDir: string;
        files?: string[];
        outFile?: string;
        outDir?: string;
    }): Promise<string> {
        const zipOptions: any = {
            rootDir: options.rootDir,
            files: options.files || [
                'source/**/*',
                'components/**/*',
                'images/**/*',
                'manifest'
            ],
            outFile: options.outFile || 'app.zip',
            outDir: options.outDir || './build'
        };



        const result: any = await rokuDeploy.zipPackage(zipOptions);
        const zipPath = result.packagePath || path.join(result.outDir, result.outFile);

        // Ensure the zip was created
        if (!fs.existsSync(zipPath)) {
            throw new Error(`Failed to create zip at: ${zipPath}`);
        }



        return zipPath;
    }

    /**
     * Validate project structure
     */
    validateProject(rootDir: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];



        // Check for manifest
        const manifestPath = path.join(rootDir, 'manifest');
        if (!fs.existsSync(manifestPath)) {
            errors.push('Missing required file: manifest');
        } else {

        }

        // Check for source directory
        const sourcePath = path.join(rootDir, 'source');
        if (!fs.existsSync(sourcePath)) {
            errors.push('Missing required directory: source');
        } else {

            // Check for main.brs
            const mainPath = path.join(sourcePath, 'main.brs');
            if (!fs.existsSync(mainPath)) {
                errors.push('Missing required file: source/main.brs');
            } else {

            }
        }



        return {
            valid: errors.length === 0,
            errors
        };
    }
} 