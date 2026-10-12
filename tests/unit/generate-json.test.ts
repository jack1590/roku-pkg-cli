import { runGenerateJson, GenerateDeps } from '../../src/lib/generate-json';
import { createEmitter, PkgEvent } from '../../src/lib/events';

const project = { name: 'CNBC', rootDir: '/app', signKey: 'SECRETKEY', signPackageLocation: '/keys/cnbc.pkg', outputLocation: '/out/CNBC.pkg', defaultBuildTask: 'build:prod' };

function fakeDeps(over: Partial<GenerateDeps> = {}): Partial<GenerateDeps> {
    return {
        config: { getProject: (n) => (n === 'CNBC' ? { ...project } : undefined), getRokuDevice: () => ({ ip: '10.0.0.9', password: 'cfgpw' }) },
        home: async () => {},
        checkAuth: async () => 'ok',
        getTasks: () => [{ label: 'build:prod', type: 'npm', script: 'build' }],
        runTask: async (_t, _r, out) => out('compiled'),
        buildDir: () => '/app/dist',
        validate: () => ({ valid: true, errors: [] }),
        exists: () => true,
        rekey: async () => {},
        copyDir: () => {},
        removeDir: () => {},
        deploy: async () => {},
        sign: async () => 'pkgs/dev.pkg',
        retrieve: async () => '/tmp/x/CNBC.pkg',
        copyFile: () => {},
        mkdirp: () => {},
        size: () => 1234,
        wait: async () => {},
        readVersion: () => undefined,
        ...over,
    };
}

async function run(opts: object, deps: Partial<GenerateDeps>) {
    const lines: string[] = [];
    const code = await runGenerateJson({ project: 'CNBC', host: '10.0.0.5', password: 'devpw', ...opts }, createEmitter((l) => lines.push(l)), deps);
    return { code, events: lines.map((l) => JSON.parse(l) as PkgEvent), raw: lines.join('') };
}

describe('runGenerateJson', () => {
    it('runs every step in order and ends with an ok result', async () => {
        const { code, events } = await run({}, fakeDeps());
        expect(code).toBe(0);
        const steps = events.filter((e) => e.type === 'step' && e.status === 'done').map((e) => (e as { step: string }).step);
        expect(steps).toEqual(['home', 'build', 'validate', 'rekey', 'deploy', 'sign', 'save']);
        expect(events.at(-1)).toEqual({ type: 'result', ok: true, packagePath: '/out/CNBC.pkg', sizeBytes: 1234 });
        expect(events.some((e) => e.type === 'log' && e.text === 'compiled')).toBe(true);
    });

    it('uses --host over the configured device', async () => {
        const seen: string[] = [];
        await run({}, fakeDeps({ deploy: async (o) => { seen.push(o.host); } }));
        expect(seen).toEqual(['10.0.0.5']);
    });

    it('never prints the sign key or password', async () => {
        const { raw } = await run({}, fakeDeps({ rekey: async () => { throw new Error('rejected'); } }));
        expect(raw).not.toContain('SECRETKEY');
        expect(raw).not.toContain('devpw');
    });

    it('fails with NEEDS_BUILD_CHOICE when tasks exist but none is chosen', async () => {
        const deps = fakeDeps({ config: { getProject: () => ({ ...project, defaultBuildTask: undefined }), getRokuDevice: () => ({ ip: '', password: '' }) } });
        const { code, events } = await run({}, deps);
        expect(code).toBe(1);
        expect(events.at(-1)).toMatchObject({ type: 'result', ok: false, code: 'NEEDS_BUILD_CHOICE' });
    });

    it('maps each failure to its code and step', async () => {
        const cases: [Partial<GenerateDeps>, string, string][] = [
            [{ checkAuth: async () => 'unreachable' }, 'DEVICE_UNREACHABLE', 'home'],
            [{ checkAuth: async () => 'auth' }, 'AUTH_FAILED', 'home'],
            [{ runTask: async () => { throw new Error('exit 2'); } }, 'BUILD_FAILED', 'build'],
            [{ validate: () => ({ valid: false, errors: ['manifest missing'] }) }, 'INVALID_BUILD', 'validate'],
            [{ exists: (p) => p !== '/keys/cnbc.pkg' }, 'SIGNED_PKG_MISSING', 'validate'],
            [{ rekey: async () => { throw new Error('bad'); } }, 'REKEY_FAILED', 'rekey'],
            [{ deploy: async () => { throw new Error('bad'); } }, 'DEPLOY_FAILED', 'deploy'],
            [{ sign: async () => { throw new Error('bad'); } }, 'SIGN_FAILED', 'sign'],
        ];
        for (const [over, codeName, step] of cases) {
            const { code, events } = await run({}, fakeDeps(over));
            expect(code).toBe(1);
            expect(events.at(-1)).toMatchObject({ type: 'result', ok: false, code: codeName, step });
            expect(events.filter((e) => e.type === 'result')).toHaveLength(1);
        }
    });

    it('fails PROJECT_NOT_FOUND and TASK_NOT_FOUND', async () => {
        expect((await run({ project: 'Nope' }, fakeDeps())).events.at(-1)).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
        expect((await run({ buildTask: 'nope' }, fakeDeps())).events.at(-1)).toMatchObject({ code: 'TASK_NOT_FOUND', step: 'build' });
    });

    it('skips build, rekey and deploy when asked', async () => {
        const { events } = await run({ skipBuild: true, skipRekey: true, packageOnly: true }, fakeDeps());
        const skipped = events.filter((e) => e.type === 'step' && e.status === 'skip').map((e) => (e as { step: string }).step);
        expect(skipped).toEqual(['build', 'rekey', 'deploy']);
    });

    it('cancels: cleans the temp dir and returns 130', async () => {
        const ac = new AbortController();
        const removed: string[] = [];
        const deps = fakeDeps({ deploy: async () => { ac.abort(); throw new Error('aborted'); }, removeDir: (p) => { removed.push(p); } });
        const { code, events } = await run({ signal: ac.signal }, deps);
        expect(code).toBe(130);
        expect(events.at(-1)).toMatchObject({ type: 'result', ok: false, code: 'CANCELLED', step: 'deploy' });
        expect(removed).toContain('/app/.roku-deploy-temp');
    });
    it('cancel during sign ends CANCELLED, not ok', async () => {
        const ac = new AbortController();
        const deps = fakeDeps({ sign: async () => { ac.abort(); return 'pkgs/dev.pkg'; } });
        const { code, events } = await run({ signal: ac.signal }, deps);
        expect(code).toBe(130);
        expect(events.at(-1)).toMatchObject({ ok: false, code: 'CANCELLED' });
    });

    it('downloads to a temp folder so a failed download never overwrites the last package', async () => {
        const outDirs: string[] = [];
        const deps = fakeDeps({ retrieve: async (_r, o) => { outDirs.push(o.outDir); throw new Error('HTTP 500'); } });
        const { events } = await run({}, deps);
        expect(outDirs[0]).not.toBe('/out');
        expect(events.at(-1)).toMatchObject({ ok: false, code: 'SIGN_FAILED' });
    });
});
