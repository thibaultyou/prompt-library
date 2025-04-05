import crypto from 'crypto';
import * as fs from 'fs/promises';

import * as fsExtra from 'fs-extra';
import * as yaml from 'js-yaml';

import { AppError } from '../../error/services/error.service';

export async function readFileContent(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw new AppError(
            'FS_READ_ERROR',
            `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        throw new AppError(
            'FS_WRITE_ERROR',
            `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function readDirectory(dirPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dirPath);
        return entries;
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        throw new AppError(
            'FS_READDIR_ERROR',
            `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function createDirectory(dirPath: string): Promise<void> {
    try {
        await fsExtra.ensureDir(dirPath);
    } catch (error) {
        console.error(`Error creating directory ${dirPath}:`, error);
        throw new AppError(
            'FS_MKDIR_ERROR',
            `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
        await fsExtra.move(oldPath, newPath, { overwrite: false });
    } catch (error) {
        console.error(`Error renaming/moving from ${oldPath} to ${newPath}:`, error);
        throw new AppError(
            'FS_RENAME_ERROR',
            `Failed to rename/move from ${oldPath} to ${newPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function copyFile(src: string, dst: string): Promise<void> {
    try {
        await fsExtra.copy(src, dst);
    } catch (error) {
        console.error(`Error copying file from ${src} to ${dst}:`, error);
        throw new AppError(
            'FS_COPY_ERROR',
            `Failed to copy file from ${src} to ${dst}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function removeDirectory(dirPath: string): Promise<void> {
    try {
        await fsExtra.remove(dirPath);
    } catch (error) {
        console.error(`Error removing directory ${dirPath}:`, error);
        throw new AppError(
            'FS_RMDIR_ERROR',
            `Failed to remove directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function emptyDirectory(dirPath: string): Promise<void> {
    try {
        await fsExtra.emptyDir(dirPath);
    } catch (error) {
        console.error(`Error emptying directory ${dirPath}:`, error);
        throw new AppError(
            'FS_EMPTYDIR_ERROR',
            `Failed to empty directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        return await fsExtra.pathExists(filePath);
    } catch {
        return false;
    }
}

export async function isDirectory(itemPath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(itemPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

export async function isFile(itemPath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(itemPath);
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
        console.error(`Error parsing YAML file ${filePath}:`, error);
        throw new AppError(
            'YAML_PARSE_ERROR',
            `Failed to parse YAML file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
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
        console.error('Error dumping data to YAML:', error);
        throw new AppError(
            'YAML_DUMP_ERROR',
            `Failed to dump data to YAML: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
