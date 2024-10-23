import { Dirent, Stats } from 'fs';
import * as fs from 'fs/promises';

import { jest } from '@jest/globals';

import { handleError } from '../../../cli/utils/errors';
import {
    readFileContent,
    writeFileContent,
    readDirectory,
    createDirectory,
    renameFile,
    copyFile,
    removeDirectory,
    fileExists,
    isDirectory,
    isFile
} from '../file-system';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);
jest.mock('../../../cli/utils/errors');
const mockHandleError = jest.mocked(handleError);
describe('FileSystemUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('readFileContent', () => {
        it('should read file content successfully', async () => {
            const testContent = 'test content';
            mockFs.readFile.mockResolvedValue(testContent);

            const result = await readFileContent('test.txt');
            expect(result).toBe(testContent);
            expect(mockFs.readFile).toHaveBeenCalledWith('test.txt', 'utf-8');
        });

        it('should handle errors when reading file', async () => {
            const error = new Error('Read error');
            mockFs.readFile.mockRejectedValue(error);

            await expect(readFileContent('test.txt')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'reading file test.txt');
        });
    });

    describe('writeFileContent', () => {
        it('should write file content successfully', async () => {
            const testContent = 'test content';
            mockFs.writeFile.mockResolvedValue();

            await writeFileContent('test.txt', testContent);

            expect(mockFs.writeFile).toHaveBeenCalledWith('test.txt', testContent, 'utf-8');
        });

        it('should handle errors when writing file', async () => {
            const error = new Error('Write error');
            mockFs.writeFile.mockRejectedValue(error);

            await expect(writeFileContent('test.txt', 'content')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'writing file test.txt');
        });
    });

    describe('readDirectory', () => {
        it('should read directory contents successfully', async () => {
            const testFiles = ['file1.txt', 'file2.txt'];
            (mockFs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
                testFiles as unknown as Dirent[]
            );

            const result = await readDirectory('testDir');
            expect(result).toEqual(testFiles);
            expect(mockFs.readdir).toHaveBeenCalledWith('testDir', { withFileTypes: false });
        });

        it('should handle errors when reading directory', async () => {
            const error = new Error('Read dir error');
            mockFs.readdir.mockRejectedValue(error);

            await expect(readDirectory('testDir')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'reading directory testDir');
        });
    });

    describe('createDirectory', () => {
        it('should create directory successfully', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);

            await createDirectory('testDir');

            expect(mockFs.mkdir).toHaveBeenCalledWith('testDir', { recursive: true });
        });

        it('should handle errors when creating directory', async () => {
            const error = new Error('Create dir error');
            mockFs.mkdir.mockRejectedValue(error);

            await expect(createDirectory('testDir')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'creating directory testDir');
        });
    });

    describe('renameFile', () => {
        it('should rename file successfully', async () => {
            mockFs.rename.mockResolvedValue();

            await renameFile('old.txt', 'new.txt');

            expect(mockFs.rename).toHaveBeenCalledWith('old.txt', 'new.txt');
        });

        it('should handle errors when renaming file', async () => {
            const error = new Error('Rename error');
            mockFs.rename.mockRejectedValue(error);

            await expect(renameFile('old.txt', 'new.txt')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'renaming file from old.txt to new.txt');
        });
    });

    describe('copyFile', () => {
        it('should copy file successfully', async () => {
            mockFs.copyFile.mockResolvedValue();

            await copyFile('src.txt', 'dst.txt');

            expect(mockFs.copyFile).toHaveBeenCalledWith('src.txt', 'dst.txt');
        });

        it('should handle errors when copying file', async () => {
            const error = new Error('Copy error');
            mockFs.copyFile.mockRejectedValue(error);

            await expect(copyFile('src.txt', 'dst.txt')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'copying file from src.txt to dst.txt');
        });
    });

    describe('removeDirectory', () => {
        it('should remove directory successfully', async () => {
            mockFs.rm.mockResolvedValue();

            await removeDirectory('testDir');

            expect(mockFs.rm).toHaveBeenCalledWith('testDir', { recursive: true, force: true });
        });

        it('should handle errors when removing directory', async () => {
            const error = new Error('Remove dir error');
            mockFs.rm.mockRejectedValue(error);

            await expect(removeDirectory('testDir')).rejects.toThrow(error);
            expect(mockHandleError).toHaveBeenCalledWith(error, 'removing directory testDir');
        });
    });

    describe('fileExists', () => {
        it('should return true when file exists', async () => {
            mockFs.access.mockResolvedValue();

            const result = await fileExists('test.txt');
            expect(result).toBe(true);
            expect(mockFs.access).toHaveBeenCalledWith('test.txt');
        });

        it('should return false when file does not exist', async () => {
            mockFs.access.mockRejectedValue(new Error('File not found'));

            const result = await fileExists('test.txt');
            expect(result).toBe(false);
        });
    });

    describe('isDirectory', () => {
        it('should return true for directories', async () => {
            mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);

            const result = await isDirectory('testDir');
            expect(result).toBe(true);
            expect(mockFs.stat).toHaveBeenCalledWith('testDir');
        });

        it('should return false for non-directories', async () => {
            mockFs.stat.mockResolvedValue({ isDirectory: () => false } as Stats);

            const result = await isDirectory('test.txt');
            expect(result).toBe(false);
        });

        it('should return false when path does not exist', async () => {
            mockFs.stat.mockRejectedValue(new Error('Path not found'));

            const result = await isDirectory('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('isFile', () => {
        it('should return true for files', async () => {
            mockFs.stat.mockResolvedValue({ isFile: () => true } as Stats);

            const result = await isFile('test.txt');
            expect(result).toBe(true);
            expect(mockFs.stat).toHaveBeenCalledWith('test.txt');
        });

        it('should return false for non-files', async () => {
            mockFs.stat.mockResolvedValue({ isFile: () => false } as Stats);

            const result = await isFile('testDir');
            expect(result).toBe(false);
        });

        it('should return false when path does not exist', async () => {
            mockFs.stat.mockRejectedValue(new Error('Path not found'));

            const result = await isFile('nonexistent');
            expect(result).toBe(false);
        });
    });
});
