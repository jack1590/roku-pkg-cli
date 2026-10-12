import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const root = path.join(__dirname, '..', '..');
const cli = path.join(root, 'dist', 'index.js');

function runCli(args: string[]) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rpk-home-'));
    fs.mkdirSync(path.join(home, '.roku-pkg'));
    fs.writeFileSync(path.join(home, '.roku-pkg', 'config.json'), JSON.stringify({ rokuDevice: { ip: '', password: '' }, projects: [] }));
    return spawnSync(process.execPath, [cli, ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8', timeout: 20000 });
}

const lastEvent = (stdout: string) => JSON.parse(stdout.trim().split('\n').at(-1)!);

describe('generate --json (built CLI)', () => {
    beforeAll(() => { spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'ignore' }); }, 60000);

    it('prints only JSON lines and never prompts', () => {
        const r = runCli(['generate', 'Nope', '--json', '--host', '127.0.0.1', '--password', 'x']);
        const events = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
        expect(events.at(-1)).toMatchObject({ type: 'result', ok: false, code: 'PROJECT_NOT_FOUND' });
        expect(r.status).toBe(1);
    });

    it('refuses --host with --discover', () => {
        const r = runCli(['generate', 'Nope', '--json', '--host', '1.2.3.4', '--discover']);
        expect(r.status).toBe(1);
        expect(lastEvent(r.stdout)).toMatchObject({ ok: false, code: 'UNKNOWN', message: expect.stringMatching(/--host.*--discover/) });
    });

    it('a missing project name fails instead of prompting', () => {
        const r = runCli(['generate', '--json']);
        expect(lastEvent(r.stdout)).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    });
});
