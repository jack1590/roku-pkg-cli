import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import axios from 'axios';
import { rokuDeploy } from 'roku-deploy';
import { ConfigManager } from './config-manager';
import { RokuDeployManager } from './roku-deploy';
import { Emitter, ErrorCode, GenerateError, Step } from './events';
import { getBuildDirectory } from '../utils/vscode-config';
import { executeTask, getAllTasks, VSCodeTask } from '../utils/vscode-tasks';
import { readManifest } from './inspect';
import { Project, RokuDevice } from '../types';

export interface GenerateJsonOptions {
    project?: string;
    host?: string;
    password?: string;
    buildTask?: string;
    useExistingBuild?: boolean;
    skipBuild?: boolean;
    skipRekey?: boolean;
    packageOnly?: boolean;
    signal?: AbortSignal;
}

/** Everything that touches the device, the disk or the clock, so the pipeline can be tested without a Roku. */
export interface GenerateDeps {
    config: { getProject(name: string): Project | undefined; getRokuDevice(): RokuDevice };
    home(ip: string): Promise<void>;
    checkAuth(ip: string, password: string): Promise<'ok' | 'unreachable' | 'auth'>;
    getTasks(rootDir: string): VSCodeTask[];
    runTask(task: VSCodeTask, rootDir: string, onOutput: (l: string) => void, signal?: AbortSignal): Promise<void>;
    buildDir(rootDir: string): string;
    validate(dir: string): { valid: boolean; errors: string[] };
    exists(p: string): boolean;
    rekey(o: { host: string; password: string; rekeySignedPackage: string; signingPassword: string }): Promise<void>;
    copyDir(from: string, to: string): void;
    removeDir(p: string): void;
    deploy(o: { host: string; password: string; rootDir: string }): Promise<void>;
    /** Returns the package path on the device. */
    sign(o: { host: string; password: string; rootDir: string; signingPassword: string }): Promise<string>;
    /** Returns the local path it downloaded to. */
    retrieve(remotePath: string, o: { host: string; password: string; outDir: string; outFile: string }): Promise<string>;
    copyFile(from: string, to: string): void;
    mkdirp(dir: string): void;
    size(p: string): number;
    wait(ms: number): Promise<void>;
    readVersion(rootDir: string): string | undefined;
}

const BUILD_TIMEOUT_MS = 300_000;
const DEPLOY_TIMEOUT_MS = 300_000;

function realDeps(): GenerateDeps {
    const manager = new RokuDeployManager();
    // roku-deploy's digest-auth request helpers are private in its typings but stable in 3.x.
    const rd = rokuDeploy as unknown as {
        generateBaseRequestOptions(p: string, o: object): object;
        doGetRequest(params: object): Promise<unknown>;
    };
    return {
        config: new ConfigManager(),
        home: async (ip) => { await axios.post(`http://${ip}:8060/keypress/home`, undefined, { timeout: 5000, validateStatus: () => true }); },
        checkAuth: async (ip, password) => {
            try { await axios.get(`http://${ip}:8060/query/device-info`, { timeout: 5000 }); } catch { return 'unreachable'; }
            try {
                await rd.doGetRequest(rd.generateBaseRequestOptions('plugin_inspect', { host: ip, password, username: 'rokudev', timeout: 10000 }));
                return 'ok';
            } catch (e) {
                // Only a real 401 is an auth failure; anything else is left for the next steps to report.
                return /unauthori[sz]ed|401/i.test(String((e as Error)?.message ?? e)) ? 'auth' : 'ok';
            }
        },
        getTasks: getAllTasks,
        runTask: (task, rootDir, onOutput, signal) => executeTask(task, rootDir, BUILD_TIMEOUT_MS, onOutput, signal),
        buildDir: getBuildDirectory,
        validate: (dir) => manager.validateProject(dir),
        exists: fs.existsSync,
        rekey: (o) => manager.rekeyDevice(o),
        copyDir: (from, to) => fs.cpSync(from, to, { recursive: true }),
        removeDir: (p) => fs.rmSync(p, { recursive: true, force: true }),
        deploy: async (o) => {
            const stagingDir = path.join(os.tmpdir(), `roku-pkg-staging-${process.pid}`);
            try {
                await rokuDeploy.deploy({ host: o.host, password: o.password, rootDir: o.rootDir, files: ['**/*'], stagingDir, outDir: os.tmpdir(), outFile: `roku-pkg-${process.pid}` });
            } finally {
                fs.rmSync(stagingDir, { recursive: true, force: true });
            }
        },
        // signExistingPackage only reads the manifest from stagingDir, and the build copy has one.
        sign: (o) => rokuDeploy.signExistingPackage({ host: o.host, password: o.password, signingPassword: o.signingPassword, stagingDir: o.rootDir }),
        retrieve: (remote, o) => rokuDeploy.retrieveSignedPackage(remote, { host: o.host, password: o.password, outDir: o.outDir, outFile: o.outFile }),
        copyFile: fs.copyFileSync,
        mkdirp: (dir) => fs.mkdirSync(dir, { recursive: true }),
        size: (p) => fs.statSync(p).size,
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
        readVersion: (rootDir) => readManifest(rootDir)?.version,
    };
}

function withTimeout<T>(p: Promise<T>, ms: number, step: Step): Promise<T> {
    let t: NodeJS.Timeout | undefined;
    return Promise.race([
        p.finally(() => clearTimeout(t)),
        new Promise<T>((_, reject) => {
            t = setTimeout(() => reject(new GenerateError('DEPLOY_TIMEOUT', `Timed out after ${ms / 60000} minutes`, { step, hint: 'Check the device responds at http://<ip>, or build first and use --use-existing-build.' })), ms);
        }),
    ]);
}

/**
 * `roku-pkg generate --json`: the same work as the interactive command, but never prompts.
 * Emits step/log events and exactly one result event last. Returns the exit code.
 */
export async function runGenerateJson(opts: GenerateJsonOptions, emitter: Emitter, override: Partial<GenerateDeps> = {}): Promise<number> {
    // Tests pass a full set of fakes; the CLI passes none and gets the real device, disk and clock.
    const deps = (Object.keys(override).length ? override : realDeps()) as GenerateDeps;
    let current: Step | undefined;
    let tempDir: string | undefined;
    const started = new Map<Step, number>();
    const start = (s: Step, detail?: string) => { current = s; started.set(s, Date.now()); emitter.step(s, 'start', detail ? { detail } : undefined); };
    const done = (s: Step) => emitter.step(s, 'done', { ms: Date.now() - (started.get(s) ?? Date.now()) });
    const skip = (s: Step, detail?: string) => emitter.step(s, 'skip', detail ? { detail } : undefined);
    const checkCancel = () => { if (opts.signal?.aborted) throw new GenerateError('CANCELLED', 'Cancelled', { step: current }); };
    const fail = (code: ErrorCode, message: string, hint?: string): never => { throw new GenerateError(code, message, { step: current, hint }); };

    try {
        const project = opts.project ? deps.config.getProject(opts.project) : undefined;
        if (!project) return fail('PROJECT_NOT_FOUND', `Project '${opts.project ?? ''}' not found.`, 'Run roku-pkg list to see the configured projects.');
        const configured = deps.config.getRokuDevice();
        const host = opts.host || configured.ip;
        const password = opts.password ?? configured.password;

        start('home');
        const auth = await deps.checkAuth(host, password);
        if (auth === 'unreachable') fail('DEVICE_UNREACHABLE', `Cannot reach the Roku at ${host}.`, 'Check it is on and on the same network, with developer mode enabled.');
        if (auth === 'auth') fail('AUTH_FAILED', `The device at ${host} rejected the developer password.`);
        await deps.home(host).catch(() => emitter.log('warn', 'Could not send the device home; continuing.'));
        await deps.wait(2000);
        done('home');
        checkCancel();

        const tasks = deps.getTasks(project.rootDir);
        if (opts.skipBuild) skip('build', 'no build');
        else if (opts.useExistingBuild) skip('build', 'used existing build');
        else {
            const label = opts.buildTask ?? project.defaultBuildTask;
            current = 'build';
            if (!label && tasks.length) fail('NEEDS_BUILD_CHOICE', 'Pick a build task, --use-existing-build or --skip-build.');
            if (!label) skip('build', 'no build tasks');
            else {
                const task = tasks.find((t) => t.label === label);
                if (!task) return fail('TASK_NOT_FOUND', `Task "${label}" not found.`, `Available: ${tasks.map((t) => t.label).join(', ') || 'none'}`);
                start('build', label);
                try {
                    await deps.runTask(task, project.rootDir, (l) => emitter.log('info', l), opts.signal);
                } catch (e) {
                    checkCancel();
                    const msg = (e as Error).message;
                    fail(/timed out|terminated/i.test(msg) ? 'BUILD_TIMEOUT' : 'BUILD_FAILED', msg, 'Open the log for the build output. Run the task in a terminal to reproduce.');
                }
                done('build');
            }
        }
        checkCancel();

        start('validate');
        const buildDir = deps.buildDir(project.rootDir);
        const v = deps.validate(buildDir);
        if (!v.valid) fail('INVALID_BUILD', `The build folder ${buildDir} is not a Roku app: ${v.errors.join('; ')}`, 'Build the project first, or pick a build task.');
        if (!deps.exists(project.signPackageLocation)) fail('SIGNED_PKG_MISSING', `Signed package not found: ${project.signPackageLocation}`, 'Edit the project and choose the signed .pkg again.');
        done('validate');
        checkCancel();

        if (opts.skipRekey) skip('rekey');
        else {
            start('rekey');
            try {
                await deps.rekey({ host, password, rekeySignedPackage: project.signPackageLocation, signingPassword: project.signKey });
            } catch {
                checkCancel();
                fail('REKEY_FAILED', `The sign key doesn't match ${path.basename(project.signPackageLocation)}.`, 'The key and the signed package have to come from the same genkey run.');
            }
            await deps.wait(5000);
            done('rekey');
        }
        checkCancel();

        // Copy the build aside: some compilers clean their output asynchronously.
        tempDir = path.join(project.rootDir, '.roku-deploy-temp');
        deps.removeDir(tempDir);
        deps.copyDir(buildDir, tempDir);

        if (opts.packageOnly) skip('deploy', 'package only');
        else {
            start('deploy');
            try {
                await withTimeout(deps.deploy({ host, password, rootDir: tempDir }), DEPLOY_TIMEOUT_MS, 'deploy');
            } catch (e) {
                checkCancel();
                if (e instanceof GenerateError) throw e;
                fail('DEPLOY_FAILED', (e as Error).message, 'Check the device is reachable and the dev password is right.');
            }
            done('deploy');
        }
        checkCancel();

        start('sign');
        let local = '';
        try {
            const remote = await deps.sign({ host, password, rootDir: tempDir, signingPassword: project.signKey });
            local = await deps.retrieve(remote, { host, password, outDir: path.dirname(project.outputLocation), outFile: path.basename(project.outputLocation, '.pkg') });
        } catch (e) {
            checkCancel();
            fail('SIGN_FAILED', (e as Error).message, 'Packaging needs the app deployed on the device; run without --package-only.');
        }
        done('sign');

        start('save');
        deps.mkdirp(path.dirname(project.outputLocation));
        if (local !== project.outputLocation) deps.copyFile(local, project.outputLocation);
        done('save');

        await deps.home(host).catch(() => undefined);
        emitter.emit({ type: 'result', ok: true, packagePath: project.outputLocation, sizeBytes: deps.size(project.outputLocation), version: deps.readVersion(project.rootDir) });
        return 0;
    } catch (e) {
        const err = opts.signal?.aborted
            ? new GenerateError('CANCELLED', 'Cancelled', { step: current })
            : e instanceof GenerateError ? e : new GenerateError('UNKNOWN', (e as Error)?.message ?? String(e), { step: current });
        if (err.step) emitter.step(err.step, 'fail');
        emitter.emit({ type: 'result', ok: false, step: err.step, code: err.code, message: err.message, ...(err.hint ? { hint: err.hint } : {}) });
        return err.code === 'CANCELLED' ? 130 : 1;
    } finally {
        if (tempDir) {
            try { deps.removeDir(tempDir); } catch { /* best effort */ }
        }
    }
}

