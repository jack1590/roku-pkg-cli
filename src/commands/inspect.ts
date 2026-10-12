import { Command } from 'commander';
import * as path from 'path';
import { inspectProject } from '../lib/inspect';

export function inspectCommand(program: Command): void {
    program
        .command('inspect <dir>')
        .description('Show what roku-pkg detects in a Roku app folder (manifest, build folder, VSCode tasks)')
        .option('--json', 'Print one JSON object')
        .action((dir: string, options: { json?: boolean }) => {
            const result = inspectProject(path.resolve(dir.replace(/^~(?=$|\/)/, process.env.HOME ?? '~')));
            if (options.json) {
                process.stdout.write(JSON.stringify(result) + '\n');
                return;
            }
            console.log(`Manifest: ${result.manifest ? `${result.manifest.title ?? '?'} ${result.manifest.version ?? ''}` : 'not found'}`);
            console.log(`Build folder: ${result.buildDir} (${result.buildDirSource}${result.buildExists ? '' : ', not built'})`);
            console.log(`Tasks: ${result.tasks.map((t) => t.label).join(', ') || 'none'}`);
        });
}
