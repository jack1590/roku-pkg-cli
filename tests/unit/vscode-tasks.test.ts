import { executeTask } from '../../src/utils/vscode-tasks';
import * as os from 'os';

describe('executeTask onOutput', () => {
    it('streams child output lines to the callback', async () => {
        const lines: string[] = [];
        await executeTask({ label: 'echo', type: 'shell', command: 'echo hi && echo err 1>&2' }, os.tmpdir(), 10000, (l) => lines.push(l));
        expect(lines).toEqual(expect.arrayContaining(['hi', 'err']));
        expect(lines.some((l) => l.startsWith('Executing:'))).toBe(true);
    });

    it('rejects when aborted', async () => {
        const ac = new AbortController();
        const p = executeTask({ label: 'sleep', type: 'shell', command: 'sleep 5' }, os.tmpdir(), 10000, () => {}, ac.signal);
        setTimeout(() => ac.abort(), 100);
        await expect(p).rejects.toThrow(/terminated/);
    });
});
