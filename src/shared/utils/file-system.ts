import crypto from 'crypto';
import * as fs from 'fs/promises';

import * as yaml from 'js-yaml';

import { handleError } from '../../cli/utils/errors';

export async function readFileContent(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        handleError(error, `reading file ${filePath}`);
        throw error;
    }
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
        handleError(error, `writing file ${filePath}`);
        throw error;
    }
}

export async function readDirectory(dirPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: false });
        return entries;
    } catch (error) {
        handleError(error, `reading directory ${dirPath}`);
        throw error;
    }
}

export async function createDirectory(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        handleError(error, `creating directory ${dirPath}`);
        throw error;
    }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
        await fs.rename(oldPath, newPath);
    } catch (error) {
        handleError(error, `renaming file from ${oldPath} to ${newPath}`);
        throw error;
    }
}

export async function copyFile(src: string, dst: string): Promise<void> {
    try {
        await fs.copyFile(src, dst);
    } catch (error) {
        handleError(error, `copying file from ${src} to ${dst}`);
        throw error;
    }
}

export async function removeDirectory(dirPath: string): Promise<void> {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
        handleError(error, `removing directory ${dirPath}`);
        throw error;
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function isDirectory(path: string): Promise<boolean> {
    try {
        const stats = await fs.stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

export async function isFile(path: string): Promise<boolean> {
    try {
        const stats = await fs.stat(path);
        return stats.isFile();
    } catch {
        return false;
    }
}

export async function generateContentHash(content: string): Promise<string> {
    return crypto.createHash('md5').update(content).digest('hex');
}

export async function parseYaml<T = any>(filePath: string): Promise<T> {
    try {
        const content = await readFileContent(filePath);
        return yaml.load(content) as T;
    } catch (error) {
        handleError(error, `parsing YAML file ${filePath}`);
        throw error;
    }
}

export function dumpYaml(data: any): string {
    try {
        return yaml.dump(data, {
            indent: 2,
            lineWidth: 100,
            noRefs: true
        });
    } catch (error) {
        handleError(error, 'dumping data to YAML');
        throw error;
    }
}
