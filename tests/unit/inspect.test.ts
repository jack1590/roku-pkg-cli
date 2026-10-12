import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inspectProject } from '../../src/lib/inspect';

function fixture(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpk-'));
    fs.writeFileSync(path.join(dir, 'manifest'), 'title=CNBC\nmajor_version=4\nminor_version=12\nbuild_version=0\n');
    fs.mkdirSync(path.join(dir, '.vscode'));
    fs.mkdirSync(path.join(dir, 'dist/source'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist/manifest'), 'title=CNBC\n');
    fs.writeFileSync(path.join(dir, '.vscode/launch.json'), JSON.stringify({ version: '0.2.0', configurations: [{ type: 'brightscript', request: 'launch', name: 'x', rootDir: dir, outDir: 'dist' }] }));
    fs.writeFileSync(path.join(dir, '.vscode/tasks.json'), JSON.stringify({ version: '2.0.0', tasks: [{ label: 'build:prod', type: 'npm', script: 'build' }, { label: 'lint', type: 'npm', script: 'lint' }] }));
    return dir;
}

describe('inspectProject', () => {
    it('reads manifest, build dir and tasks', () => {
        const dir = fixture();
        const r = inspectProject(dir);
        expect(r.manifest).toEqual({ title: 'CNBC', version: '4.12.0' });
        expect(r.buildDir).toBe(path.join(dir, 'dist'));
        expect(r.buildDirSource).toBe('launch.json');
        expect(r.buildExists).toBe(true);
        expect(typeof r.buildMtime).toBe('number');
        expect(r.tasks).toEqual([{ label: 'build:prod', isBuild: true }, { label: 'lint', isBuild: false }]);
    });

    it('returns null manifest for a folder without one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpk-'));
        const r = inspectProject(dir);
        expect(r.manifest).toBeNull();
        expect(r.buildDirSource).toBe('root');
        expect(r.tasks).toEqual([]);
    });
});
