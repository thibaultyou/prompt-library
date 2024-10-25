import fs from 'fs-extra';

import { readDirectory } from '../../../shared/utils/file-system';
import { cliConfig } from '../../config/cli-config';
import { hasPrompts, hasFragments } from '../file-system';

jest.mock('fs-extra');
jest.mock('../../../shared/utils/file-system');
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

describe('FileSystemUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
