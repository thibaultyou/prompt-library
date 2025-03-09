import fs from 'fs-extra';

import { getConfig } from '../../../shared/config';
import logger from '../../../shared/utils/logger';
import syncCommand from '../sync-command';
import { createMockCommand, parseCommand } from './command-test-utils';
import * as syncUtils from '../../utils/sync-utils';

jest.mock('../../../shared/config');
jest.mock('../../../shared/utils/logger');
jest.mock('fs-extra');
jest.mock('simple-git');
jest.mock('@inquirer/prompts');
jest.mock('../../utils/sync-utils');

const inquirer = jest.requireMock('@inquirer/prompts');
describe('SyncCommand', () => {
    const mockGetRepoUrl = syncUtils.getRepoUrl as jest.MockedFunction<typeof syncUtils.getRepoUrl>;
    const mockCleanupTempDir = syncUtils.cleanupTempDir as jest.MockedFunction<typeof syncUtils.cleanupTempDir>;
    const mockCloneRepository = syncUtils.cloneRepository as jest.MockedFunction<typeof syncUtils.cloneRepository>;
    const mockDiffDirectories = syncUtils.diffDirectories as jest.MockedFunction<typeof syncUtils.diffDirectories>;
    const mockLogChanges = syncUtils.logChanges as jest.MockedFunction<typeof syncUtils.logChanges>;
    const mockPerformSync = syncUtils.performSync as jest.MockedFunction<typeof syncUtils.performSync>;
    beforeEach(() => {
        jest.clearAllMocks();

        (getConfig as jest.Mock).mockReturnValue({
            PROMPTS_DIR: '/test/prompts',
            FRAGMENTS_DIR: '/test/fragments'
        });

        mockGetRepoUrl.mockResolvedValue('https://github.com/test/repo.git');
        mockCleanupTempDir.mockResolvedValue();
        mockCloneRepository.mockResolvedValue();
        mockDiffDirectories.mockResolvedValue([]);
        mockLogChanges.mockImplementation(() => {});
        mockPerformSync.mockResolvedValue();

        inquirer.select.mockResolvedValue('yes');
        inquirer.input.mockResolvedValue('');
    });

    it('should initialize with correct options', () => {
        const command = createMockCommand();
        command.addCommand(syncCommand);

        expect(command.commands[0].name()).toBe('sync');
        expect(command.commands[0].description()).toBe('Sync prompts with the remote repository');

        const options = command.commands[0].options;
        expect(options).toHaveLength(2);

        const urlOption = options.find((o) => o.long === '--url');
        expect(urlOption).toBeDefined();

        const forceOption = options.find((o) => o.long === '--force');
        expect(forceOption).toBeDefined();
    });

    it('should pass URL option to getRepoUrl', async () => {
        await parseCommand(syncCommand, ['-u', 'https://example.com/custom-repo.git']);

        expect(mockGetRepoUrl).toHaveBeenCalledWith('https://example.com/custom-repo.git', expect.any(Function));
    });

    it('should call all utility functions in the correct order with no changes', async () => {
        mockDiffDirectories.mockResolvedValue([]);

        await parseCommand(syncCommand, []);

        expect(mockGetRepoUrl).toHaveBeenCalled();
        expect(mockCleanupTempDir).toHaveBeenCalled();
        expect(mockCloneRepository).toHaveBeenCalled();
        expect(mockDiffDirectories).toHaveBeenCalledTimes(2);

        expect(mockLogChanges).not.toHaveBeenCalled();
        expect(mockPerformSync).not.toHaveBeenCalled();

        expect(fs.remove).toHaveBeenCalled();

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No changes detected'));
    });

    it('should process changes when detected', async () => {
        const mockChanges: syncUtils.FileChange[] = [
            { type: 'added', path: 'file1.txt' },
            { type: 'modified', path: 'file2.txt' }
        ];
        mockDiffDirectories.mockResolvedValueOnce(mockChanges).mockResolvedValueOnce([]);

        await parseCommand(syncCommand, []);

        expect(mockLogChanges).toHaveBeenCalledWith(mockChanges, 'Prompts');
        expect(mockPerformSync).toHaveBeenCalled();

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sync completed successfully'));
    });

    it('should respect user cancellation', async () => {
        mockDiffDirectories.mockResolvedValue([{ type: 'modified' as const, path: 'file.txt' }]);

        inquirer.select.mockResolvedValueOnce('no');

        await parseCommand(syncCommand, []);

        expect(mockPerformSync).not.toHaveBeenCalled();

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sync cancelled by user'));

        expect(fs.remove).toHaveBeenCalled();
    });

    it('should bypass confirmation with --force flag', async () => {
        mockDiffDirectories.mockResolvedValue([{ type: 'modified' as const, path: 'file.txt' }]);

        await parseCommand(syncCommand, ['--force']);

        expect(inquirer.select).not.toHaveBeenCalled();
        expect(mockPerformSync).toHaveBeenCalled();
    });

    it('should handle errors during sync process', async () => {
        mockCloneRepository.mockRejectedValueOnce(new Error('Failed to clone repository'));

        await parseCommand(syncCommand, []);

        expect(logger.error).toHaveBeenCalled();

        expect(inquirer.input).toHaveBeenCalled();
    });
});
