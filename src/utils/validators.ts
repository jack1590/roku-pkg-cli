import * as fs from 'fs';
import * as path from 'path';

export function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

export function isReadable(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch (error) {
        return false;
    }
}

export function validatePackageFile(filePath: string): { valid: boolean; error?: string } {
    if (!fileExists(filePath)) {
        return { valid: false, error: `File not found: ${filePath}` };
    }

    if (!isReadable(filePath)) {
        return { valid: false, error: `File is not readable: ${filePath}` };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pkg') {
        return { valid: false, error: `File must have .pkg extension: ${filePath}` };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
        return { valid: false, error: `File is empty: ${filePath}` };
    }

    return { valid: true };
}

export function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
} 