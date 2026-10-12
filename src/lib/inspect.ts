import * as fs from 'fs';
import * as path from 'path';
import { extractBuildConfig, getBuildDirectory, readBSConfig } from '../utils/vscode-config';
import { getAllTasks, getBuildTasks } from '../utils/vscode-tasks';

export interface InspectResult {
    manifest: { title?: string; version?: string } | null;
    buildDir: string;
    buildDirSource: 'launch.json' | 'bsconfig.json' | 'common' | 'root';
    buildExists: boolean;
    buildMtime?: number;
    tasks: { label: string; isBuild: boolean }[];
}

export function readManifest(dir: string): { title?: string; version?: string } | null {
    const file = path.join(dir, 'manifest');
    if (!fs.existsSync(file)) return null;
    const kv: Record<string, string> = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (m) kv[m[1]] = m[2];
    }
    const parts = [kv.major_version, kv.minor_version, kv.build_version];
    return { title: kv.title, version: parts.every((p) => p !== undefined) ? parts.join('.') : undefined };
}

export function inspectProject(dir: string): InspectResult {
    const buildDir = getBuildDirectory(dir);
    const launch = extractBuildConfig(dir);
    const bs = readBSConfig(dir);
    const resolve = (p?: string) => (p ? (path.isAbsolute(p) ? p : path.join(dir, p)) : undefined);
    const buildDirSource: InspectResult['buildDirSource'] =
        buildDir === dir ? 'root'
        : launch && [launch.stagingFolderPath, launch.outDir].includes(buildDir) ? 'launch.json'
        : bs && [resolve(bs.stagingDir), resolve(bs.outDir)].includes(buildDir) ? 'bsconfig.json'
        : 'common';
    const manifestFile = path.join(buildDir, 'manifest');
    const buildExists = buildDir !== dir && fs.existsSync(manifestFile);
    const buildLabels = new Set(getBuildTasks(dir).map((t) => t.label));
    return {
        manifest: readManifest(dir),
        buildDir,
        buildDirSource,
        buildExists,
        buildMtime: buildExists ? fs.statSync(manifestFile).mtimeMs : undefined,
        tasks: getAllTasks(dir).map((t) => ({ label: t.label, isBuild: buildLabels.has(t.label) })),
    };
}
