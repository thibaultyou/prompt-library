import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';

import { readDirectory } from '../../../shared/utils/file-system';
import { cliConfig } from '../../config/cli-config';
import { hasPrompts, hasFragments, flushDirectories } from '../file-system';
import { getConfig } from '../../../shared/config';
import { CommandError } from '../../commands/base-command';

// Mock setup
jest.mock('fs-extra');
jest.mock('../../../shared/utils/file-system');
jest.mock('../../../shared/config');
jest.mock('../../../shared/utils/logger');
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

type TestResult = {
    success: boolean;
    error?: CommandError;
};

describe('FileSystemUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getConfig as jest.Mock).mockReturnValue({
            PROMPTS_DIR: cliConfig.PROMPTS_DIR,
            FRAGMENTS_DIR: cliConfig.FRAGMENTS_DIR
        });
    });

    describe('hasPrompts', () => {
        it('should return true when prompts directory has contents', async () => {
            (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
            (readDirectory as jest.Mock).mockResolvedValue(['prompt1', 'prompt2']);

            const result = await hasPrompts();
            expect(result).toBe(true);
            expect(fs.ensureDir).toHaveBeenCalledWith(cliConfig.PROMPTS_DIR);
            expect(readDirectory).toHaveBeenCalledWith(cliConfig.PROMPTS_DIR);
        });

        it('should return false when prompts directory is empty', async () => {
            (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
            (readDirectory as jest.Mock).mockResolvedValue([]);

            const result = await hasPrompts();
            expect(result).toBe(false);
            expect(fs.ensureDir).toHaveBeenCalledWith(cliConfig.PROMPTS_DIR);
            expect(readDirectory).toHaveBeenCalledWith(cliConfig.PROMPTS_DIR);
        });

        it('should handle errors and return false', async () => {
            const error = new Error('Test error');
            (fs.ensureDir as jest.Mock).mockRejectedValue(error);

            const result = await hasPrompts();
            expect(result).toBe(false);
        });
    });

    describe('hasFragments', () => {
        it('should return true when fragments directory has contents', async () => {
            (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
            (readDirectory as jest.Mock).mockResolvedValue(['fragment1', 'fragment2']);

            const result = await hasFragments();
            expect(result).toBe(true);
            expect(fs.ensureDir).toHaveBeenCalledWith(cliConfig.FRAGMENTS_DIR);
            expect(readDirectory).toHaveBeenCalledWith(cliConfig.FRAGMENTS_DIR);
        });

        it('should return false when fragments directory is empty', async () => {
            (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
            (readDirectory as jest.Mock).mockResolvedValue([]);

            const result = await hasFragments();
            expect(result).toBe(false);
            expect(fs.ensureDir).toHaveBeenCalledWith(cliConfig.FRAGMENTS_DIR);
            expect(readDirectory).toHaveBeenCalledWith(cliConfig.FRAGMENTS_DIR);
        });

        it('should handle errors and return false', async () => {
            const error = new Error('Test error');
            (fs.ensureDir as jest.Mock).mockRejectedValue(error);

            const result = await hasFragments();
            expect(result).toBe(false);
        });
    });

    describe('flushDirectories', () => {
        it('should successfully flush directories', async () => {
            (fs.emptyDir as jest.Mock).mockResolvedValue(undefined);

            const result = await pipe(
                flushDirectories(),
                TE.match(
                    (error: CommandError): TestResult => ({ success: false, error }),
                    (): TestResult => ({ success: true })
                )
            )();

            expect(result.success).toBe(true);
            expect(fs.emptyDir).toHaveBeenCalledTimes(2);
            expect(fs.emptyDir).toHaveBeenCalledWith(getConfig().PROMPTS_DIR);
            expect(fs.emptyDir).toHaveBeenCalledWith(getConfig().FRAGMENTS_DIR);
        });

        it('should handle errors when flushing directories', async () => {
            const fsError = new Error('Flush error');
            (fs.emptyDir as jest.Mock).mockRejectedValue(fsError);

            const result = await pipe(
                flushDirectories(),
                TE.match(
                    (error: CommandError): TestResult => ({ success: false, error }),
                    (): TestResult => ({ success: true })
                )
            )();

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('FLUSH_ERROR');
            expect(result.error?.message).toBe('Failed to flush directories');
            expect(result.error?.context).toBe(fsError);
        });

        it('should handle errors for individual directories', async () => {
            (fs.emptyDir as jest.Mock)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Fragment dir error'));

            const result = await pipe(
                flushDirectories(),
                TE.match(
                    (error: CommandError): TestResult => ({ success: false, error }),
                    (): TestResult => ({ success: true })
                )
            )();

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('FLUSH_ERROR');
            expect(fs.emptyDir).toHaveBeenCalledWith(getConfig().PROMPTS_DIR);
            expect(fs.emptyDir).toHaveBeenCalledWith(getConfig().FRAGMENTS_DIR);
        });

        it('should use correct directory paths from config', async () => {
            const customConfig = {
                PROMPTS_DIR: '/custom/prompts',
                FRAGMENTS_DIR: '/custom/fragments'
            };
            (getConfig as jest.Mock).mockReturnValue(customConfig);
            (fs.emptyDir as jest.Mock).mockResolvedValue(undefined);

            await pipe(
                flushDirectories(),
                TE.match(
                    () => void 0,
                    () => void 0
                )
            )();

            expect(fs.emptyDir).toHaveBeenCalledWith(customConfig.PROMPTS_DIR);
            expect(fs.emptyDir).toHaveBeenCalledWith(customConfig.FRAGMENTS_DIR);
        });
    });
});
