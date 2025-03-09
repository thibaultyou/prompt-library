import * as path from 'path';

import { getConfig, setConfig } from '../../../shared/config';
import { getRepoUrl, diffDirectories, logChanges, syncDirectories, FileChange } from '../sync-utils';

jest.mock('../../../shared/config');
jest.mock('../../../shared/utils/logger');
jest.mock('fs-extra');
jest.mock('chalk', () => ({
    green: jest.fn((text) => `green:${text}`),
    yellow: jest.fn((text) => `yellow:${text}`),
    red: jest.fn((text) => `red:${text}`),
    bold: jest.fn((text) => `bold:${text}`)
}));

describe('SyncUtils', () => {
    const originalConsoleLog = console.log;
    let consoleOutput: string[] = [];
    beforeEach(() => {
        jest.clearAllMocks();

        consoleOutput = [];
        console.log = jest.fn((...args) => {
            consoleOutput.push(args.join(' '));
        });

        const fs = jest.requireMock('fs-extra');
        fs.readdir = jest.fn();
        fs.stat = jest.fn();
        fs.readFile = jest.fn();
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.copy = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        console.log = originalConsoleLog;
    });

    describe('getRepoUrl', () => {
        it('should return URL from options if provided', async () => {
            const promptFn = jest.fn();
            const result = await getRepoUrl('https://example.com/repo.git', promptFn);
            expect(result).toBe('https://example.com/repo.git');
            expect(promptFn).not.toHaveBeenCalled();
            expect(setConfig).not.toHaveBeenCalled();
        });

        it('should return URL from config if available', async () => {
            (getConfig as jest.Mock).mockReturnValue({
                REMOTE_REPOSITORY: 'https://github.com/config/repo.git'
            });

            const promptFn = jest.fn();
            const result = await getRepoUrl(undefined, promptFn);
            expect(result).toBe('https://github.com/config/repo.git');
            expect(promptFn).not.toHaveBeenCalled();
            expect(setConfig).not.toHaveBeenCalled();
        });

        it('should prompt for URL if not in options or config', async () => {
            (getConfig as jest.Mock).mockReturnValue({
                REMOTE_REPOSITORY: ''
            });

            const promptFn = jest.fn().mockResolvedValue('https://github.com/user/repo.git');
            const result = await getRepoUrl(undefined, promptFn);
            expect(result).toBe('https://github.com/user/repo.git');
            expect(promptFn).toHaveBeenCalledWith('Enter the remote repository URL:');
            expect(setConfig).toHaveBeenCalledWith('REMOTE_REPOSITORY', 'https://github.com/user/repo.git');
        });
    });

    describe('diffDirectories', () => {
        it('should detect added files', async () => {
            const fs = jest.requireMock('fs-extra');
            fs.readdir.mockResolvedValueOnce(['file1.txt']).mockResolvedValueOnce(['file1.txt', 'file2.txt']);

            fs.stat.mockResolvedValue({
                isDirectory: () => false
            });

            fs.readFile.mockResolvedValueOnce('content1').mockResolvedValueOnce('content1');

            const changes = await diffDirectories('/local', '/remote');
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({
                type: 'added',
                path: 'file2.txt'
            });
        });

        it('should detect modified files', async () => {
            const fs = jest.requireMock('fs-extra');
            fs.readdir.mockResolvedValueOnce(['file1.txt']).mockResolvedValueOnce(['file1.txt']);

            fs.stat.mockResolvedValue({
                isDirectory: () => false
            });

            fs.readFile.mockResolvedValueOnce('original content').mockResolvedValueOnce('modified content');

            const changes = await diffDirectories('/local', '/remote');
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({
                type: 'modified',
                path: 'file1.txt'
            });
        });

        it('should detect deleted files', async () => {
            const fs = jest.requireMock('fs-extra');
            fs.readdir.mockResolvedValueOnce(['file1.txt', 'file2.txt']).mockResolvedValueOnce(['file1.txt']);

            fs.stat.mockResolvedValue({
                isDirectory: () => false
            });

            fs.readFile.mockResolvedValueOnce('content1').mockResolvedValueOnce('content1');

            const changes = await diffDirectories('/local', '/remote');
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({
                type: 'deleted',
                path: 'file2.txt'
            });
        });
    });

    describe('logChanges', () => {
        it('should log changes with proper formatting', () => {
            const changes: FileChange[] = [
                { type: 'added', path: 'file1.txt' },
                { type: 'modified', path: 'file2.txt' },
                { type: 'deleted', path: 'file3.txt' }
            ];
            logChanges(changes, 'Test Changes');

            expect(consoleOutput).toHaveLength(4);
            expect(consoleOutput[0]).toContain('bold:');
            expect(consoleOutput[0]).toContain('Test Changes');
            expect(consoleOutput[1]).toContain('green:');
            expect(consoleOutput[1]).toContain('file1.txt');
            expect(consoleOutput[2]).toContain('yellow:');
            expect(consoleOutput[2]).toContain('file2.txt');
            expect(consoleOutput[3]).toContain('red:');
            expect(consoleOutput[3]).toContain('file3.txt');
        });

        it('should not log anything for empty changes', () => {
            logChanges([], 'Empty Changes');
            expect(consoleOutput).toHaveLength(0);
        });
    });

    describe('syncDirectories', () => {
        it('should copy added files', async () => {
            const fs = jest.requireMock('fs-extra');
            const changes: FileChange[] = [{ type: 'added', path: 'newfile.txt' }];
            await syncDirectories('/local', '/remote', changes);

            expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname('/local/newfile.txt'));
            expect(fs.copy).toHaveBeenCalledWith('/remote/newfile.txt', '/local/newfile.txt', { overwrite: true });
        });

        it('should copy modified files', async () => {
            const fs = jest.requireMock('fs-extra');
            const changes: FileChange[] = [{ type: 'modified', path: 'existing.txt' }];
            await syncDirectories('/local', '/remote', changes);

            expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname('/local/existing.txt'));
            expect(fs.copy).toHaveBeenCalledWith('/remote/existing.txt', '/local/existing.txt', { overwrite: true });
        });

        it('should remove deleted files', async () => {
            const fs = jest.requireMock('fs-extra');
            const changes: FileChange[] = [{ type: 'deleted', path: 'obsolete.txt' }];
            await syncDirectories('/local', '/remote', changes);

            expect(fs.remove).toHaveBeenCalledWith('/local/obsolete.txt');
            expect(fs.copy).not.toHaveBeenCalled();
        });
    });
});
