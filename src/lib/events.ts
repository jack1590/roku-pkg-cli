import { format } from 'util';

export type Step = 'home' | 'build' | 'validate' | 'rekey' | 'deploy' | 'sign' | 'save';
export type ErrorCode =
    | 'PROJECT_NOT_FOUND' | 'DEVICE_UNREACHABLE' | 'AUTH_FAILED' | 'NEEDS_BUILD_CHOICE'
    | 'TASK_NOT_FOUND' | 'BUILD_FAILED' | 'BUILD_TIMEOUT' | 'INVALID_BUILD' | 'SIGNED_PKG_MISSING'
    | 'REKEY_FAILED' | 'DEPLOY_FAILED' | 'DEPLOY_TIMEOUT' | 'SIGN_FAILED' | 'CANCELLED' | 'UNKNOWN';
export type StepStatus = 'start' | 'done' | 'skip' | 'fail';
export type PkgEvent =
    | { type: 'step'; step: Step; status: StepStatus; ms?: number; detail?: string }
    | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string }
    | { type: 'result'; ok: true; packagePath: string; sizeBytes: number; version?: string }
    | { type: 'result'; ok: false; step?: Step; code: ErrorCode; message: string; hint?: string };

export class GenerateError extends Error {
    code: ErrorCode;
    step?: Step;
    hint?: string;
    constructor(code: ErrorCode, message: string, opts: { step?: Step; hint?: string } = {}) {
        super(message);
        this.code = code;
        this.step = opts.step;
        this.hint = opts.hint;
    }
}

export interface Emitter {
    emit(e: PkgEvent): void;
    step(step: Step, status: StepStatus, extra?: { ms?: number; detail?: string }): void;
    log(level: 'info' | 'warn' | 'error', text: string): void;
}

export function createEmitter(write: (line: string) => void): Emitter {
    const emit = (e: PkgEvent) => write(JSON.stringify(e) + '\n');
    return {
        emit,
        step: (step, status, extra = {}) => emit({ type: 'step', step, status, ...extra }),
        log: (level, text) => emit({ type: 'log', level, text }),
    };
}

/** In --json mode stdout carries only events: route stray console output (ours and roku-deploy's) into log events. */
export function captureConsole(emitter: Emitter): () => void {
    const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    console.log = (...a: unknown[]) => emitter.log('info', format(...a));
    console.info = (...a: unknown[]) => emitter.log('info', format(...a));
    console.warn = (...a: unknown[]) => emitter.log('warn', format(...a));
    console.error = (...a: unknown[]) => emitter.log('error', format(...a));
    return () => { Object.assign(console, saved); };
}
