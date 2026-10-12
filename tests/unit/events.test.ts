import { createEmitter, captureConsole, GenerateError } from '../../src/lib/events';

describe('events', () => {
    it('writes one JSON object per line', () => {
        const lines: string[] = [];
        const e = createEmitter((l) => lines.push(l));
        e.step('home', 'start');
        e.step('home', 'done', { ms: 12 });
        e.log('info', 'hello');
        expect(lines.map((l) => JSON.parse(l))).toEqual([
            { type: 'step', step: 'home', status: 'start' },
            { type: 'step', step: 'home', status: 'done', ms: 12 },
            { type: 'log', level: 'info', text: 'hello' },
        ]);
        expect(lines.every((l) => l.endsWith('\n') && !l.slice(0, -1).includes('\n'))).toBe(true);
    });

    it('turns console output into log events and restores console', () => {
        const lines: string[] = [];
        const e = createEmitter((l) => lines.push(l));
        const original = console.log;
        const restore = captureConsole(e);
        console.log('a', 1);
        console.error('boom');
        restore();
        expect(console.log).toBe(original);
        expect(lines.map((l) => JSON.parse(l))).toEqual([
            { type: 'log', level: 'info', text: 'a 1' },
            { type: 'log', level: 'error', text: 'boom' },
        ]);
    });

    it('GenerateError carries code, step and hint', () => {
        const err = new GenerateError('REKEY_FAILED', 'bad key', { step: 'rekey', hint: 'check key' });
        expect([err.code, err.step, err.hint, err.message]).toEqual(['REKEY_FAILED', 'rekey', 'check key', 'bad key']);
    });
});
