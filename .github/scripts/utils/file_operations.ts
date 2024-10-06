import * as fs from 'fs/promises';
import logger from './logger';

/**
 * Reads the content of a file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} The content of the file as a string.
 */
export async function readFileContent(filePath: string): Promise<string> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.debug(`File read successfully: ${filePath}`);
        return content;
    } catch (error) {
        logger.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
}

/**
 * Writes content to a file.
 * @param {string} filePath - The path to the file.
 * @param {string} content - The content to write.
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        logger.debug(`File written successfully: ${filePath}`);
    } catch (error) {
        logger.error(`Error writing file ${filePath}:`, error);
        throw error;
    }
}

/**
 * Reads the contents of a directory.
 * @param {string} dirPath - The path to the directory.
 * @returns {Promise<Array{string}>} An array of file and directory names in the directory.
 */
export async function readDirectory(dirPath: string): Promise<string[]> {
    try {
        const contents = await fs.readdir(dirPath);
        logger.debug(`Directory read successfully: ${dirPath}`);
        return contents;
    } catch (error) {
        logger.error(`Error reading directory ${dirPath}:`, error);
        throw error;
    }
}

/**
 * Creates a directory.
 * @param {string} dirPath - The path of the directory to create.
 */
export async function createDirectory(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        logger.debug(`Directory created successfully: ${dirPath}`);
    } catch (error) {
        logger.error(`Error creating directory ${dirPath}:`, error);
        throw error;
    }
}

/**
 * Renames a file or directory.
 * @param {string} oldPath - The current path of the file or directory.
 * @param {string} newPath - The new path for the file or directory.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
        await fs.rename(oldPath, newPath);
        logger.debug(`File renamed successfully from ${oldPath} to ${newPath}`);
    } catch (error) {
        logger.error(`Error renaming file from ${oldPath} to ${newPath}:`, error);
        throw error;
    }
}

/**
 * Copies a file.
 * @param {string} src - The source path of the file.
 * @param {string} dst - The destination path for the file.
 */
export async function copyFile(src: string, dst: string): Promise<void> {
    try {
        await fs.copyFile(src, dst);
        logger.debug(`File copied successfully from ${src} to ${dst}`);
    } catch (error) {
        logger.error(`Error copying file from ${src} to ${dst}:`, error);
        throw error;
    }
}

/**
 * Removes a directory and its contents.
 * @param {string} dirPath - The path of the directory to remove.
 */
export async function removeDirectory(dirPath: string): Promise<void> {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
        logger.debug(`Directory removed successfully: ${dirPath}`);
    } catch (error) {
        logger.error(`Error removing directory ${dirPath}:`, error);
        throw error;
    }
}

/**
 * Checks if a file or directory exists.
 * @param {string} filePath - The path to check.
 * @returns {Promise<boolean>} True if the file or directory exists, false otherwise.
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        logger.debug(`File exists: ${filePath}`);
        return true;
    } catch {
        logger.debug(`File does not exist: ${filePath}`);
        return false;
    }
}

/**
 * Checks if a path is a directory.
 * @param {string} path - The path to check.
 * @returns {Promise<boolean>} True if the path is a directory, false otherwise.
 */
export async function isDirectory(path: string): Promise<boolean> {
    try {
        const stats = await fs.stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Checks if a path is a file.
 * @param {string} path - The path to check.
 * @returns {Promise<boolean>} True if the path is a file, false otherwise.
 */
export async function isFile(path: string): Promise<boolean> {
    try {
        const stats = await fs.stat(path);
        return stats.isFile();
    } catch {
        return false;
    }
}
