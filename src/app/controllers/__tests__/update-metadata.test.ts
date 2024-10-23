import * as crypto from 'crypto';
import * as path from 'path';

import { jest } from '@jest/globals';

import { commonConfig } from '../../../shared/config/common-config';
import { PromptMetadata } from '../../../shared/types';
import * as fileSystem from '../../../shared/utils/file-system';
import logger from '../../../shared/utils/logger';
import { appConfig } from '../../config/app-config';
import * as promptAnalyzer from '../../utils/metadata-generator';
import { generateMetadata, shouldUpdateMetadata, updateMetadataHash, updatePromptMetadata } from '../update-metadata';

jest.mock('../../../shared/utils/file-system');
jest.mock('../../utils/metadata-generator');
jest.mock('../../../shared/utils/logger');
jest.mock('fs-extra');

describe('UpdateMetadataController', () => {
    const mockPromptContent = 'Test prompt content';
    const mockMetadata: PromptMetadata = {
        title: 'Test Prompt',
        primary_category: 'Testing',
        directory: 'test-prompt',
        one_line_description: 'A test prompt',
        description: 'Test description',
        subcategories: ['unit-test'],
        tags: ['test'],
        variables: []
    };
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(promptAnalyzer.processMetadataGeneration).mockResolvedValue(mockMetadata);
        jest.mocked(fileSystem.readFileContent).mockResolvedValue(mockPromptContent);
        jest.mocked(fileSystem.fileExists).mockResolvedValue(true);
        jest.mocked(fileSystem.writeFileContent).mockResolvedValue();
        jest.mocked(fileSystem.createDirectory).mockResolvedValue();
        jest.mocked(fileSystem.isDirectory).mockResolvedValue(true);
        jest.mocked(fileSystem.readDirectory).mockResolvedValue(['test-prompt']);
        jest.mocked(fileSystem.renameFile).mockResolvedValue();
        jest.mocked(fileSystem.removeDirectory).mockResolvedValue();
        jest.mocked(fileSystem.isFile).mockResolvedValue(true);
        jest.mocked(fileSystem.copyFile).mockResolvedValue();
    });

    describe('generateMetadata', () => {
        it('should generate metadata from prompt content', async () => {
            const result = await generateMetadata(mockPromptContent);
            expect(result).toEqual(mockMetadata);
            expect(promptAnalyzer.processMetadataGeneration).toHaveBeenCalledWith(mockPromptContent);
        });

        it('should handle errors during metadata generation', async () => {
            const error = new Error('Generation failed');
            jest.mocked(promptAnalyzer.processMetadataGeneration).mockRejectedValue(error);

            await expect(generateMetadata(mockPromptContent)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('shouldUpdateMetadata', () => {
        const promptFile = 'test.md';
        const metadataFile = 'metadata.yml';
        beforeEach(() => {
            jest.mocked(fileSystem.readFileContent).mockResolvedValue(mockPromptContent);
            jest.mocked(fileSystem.fileExists).mockResolvedValue(true);
            appConfig.FORCE_REGENERATE = false;
        });

        it('should return true when force regenerate is enabled', async () => {
            appConfig.FORCE_REGENERATE = true;
            const [shouldUpdate, _promptHash] = await shouldUpdateMetadata(promptFile, metadataFile);
            expect(shouldUpdate).toBe(true);
        });

        it('should return true when metadata file does not exist', async () => {
            jest.mocked(fileSystem.fileExists).mockResolvedValue(false);
            const [shouldUpdate, _promptHash] = await shouldUpdateMetadata(promptFile, metadataFile);
            expect(shouldUpdate).toBe(true);
        });

        it('should return true when content hash is missing', async () => {
            jest.mocked(fileSystem.readFileContent).mockResolvedValue('no hash here');
            const [shouldUpdate, _promptHash] = await shouldUpdateMetadata(promptFile, metadataFile);
            expect(shouldUpdate).toBe(true);
        });

        it('should return true when content hash differs', async () => {
            const promptContent = 'prompt content';
            const differentHash = 'different-hash-value';
            jest.mocked(fileSystem.readFileContent)
                .mockResolvedValueOnce(promptContent)
                .mockResolvedValueOnce(`content_hash: ${differentHash}`);

            const [shouldUpdate] = await shouldUpdateMetadata(promptFile, metadataFile);
            expect(shouldUpdate).toBe(true);
        });

        it('should return false when content hash matches', async () => {
            appConfig.FORCE_REGENERATE = false;

            const promptContent = 'test content';
            const computedHash = crypto.createHash('md5').update(promptContent).digest('hex');
            const mockMetadataContent = `content_hash: ${computedHash}`;
            jest.mocked(fileSystem.fileExists).mockResolvedValue(true);
            jest.mocked(fileSystem.readFileContent)
                .mockResolvedValueOnce(promptContent)
                .mockResolvedValueOnce(mockMetadataContent);

            const [shouldUpdate] = await shouldUpdateMetadata(promptFile, metadataFile);
            expect(shouldUpdate).toBe(false);
        });
    });

    describe('updateMetadataHash', () => {
        const metadataFile = 'metadata.yml';
        const newHash = 'newhash123';
        it('should update existing hash in metadata file', async () => {
            const mockMetadataContent = `content_hash: oldHash123`;
            jest.mocked(fileSystem.readFileContent)
                .mockResolvedValueOnce(mockPromptContent)
                .mockResolvedValueOnce(mockMetadataContent);
            await updateMetadataHash(metadataFile, newHash);

            expect(fileSystem.writeFileContent).toHaveBeenCalledWith(
                metadataFile,
                expect.stringContaining(`content_hash: ${newHash}`)
            );
        });

        it('should add hash if not present in metadata file', async () => {
            const mockMetadataContent = `
title: Test
description: Test description
other: content
`;
            jest.mocked(fileSystem.readFileContent).mockResolvedValue(mockMetadataContent);
            await updateMetadataHash(metadataFile, newHash);

            expect(fileSystem.writeFileContent).toHaveBeenCalledWith(
                metadataFile,
                expect.stringContaining(`content_hash: ${newHash}`)
            );
        });

        it('should handle errors during hash update', async () => {
            const error = new Error('Update failed');
            jest.mocked(fileSystem.readFileContent).mockRejectedValue(error);
            jest.mocked(fileSystem.writeFileContent).mockRejectedValue(error);

            await expect(updateMetadataHash(metadataFile, newHash)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('updatePromptMetadata', () => {
        it('should process main prompt file if it exists', async () => {
            const mainPromptFile = path.join(appConfig.PROMPTS_DIR, commonConfig.PROMPT_FILE_NAME);
            jest.mocked(fileSystem.fileExists).mockResolvedValueOnce(true);

            await updatePromptMetadata();

            expect(fileSystem.readFileContent).toHaveBeenCalledWith(mainPromptFile);
            expect(fileSystem.createDirectory).toHaveBeenCalled();
            expect(fileSystem.renameFile).toHaveBeenCalled();
            expect(fileSystem.writeFileContent).toHaveBeenCalled();
        });

        it('should process prompt directories', async () => {
            jest.mocked(fileSystem.fileExists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

            await updatePromptMetadata();

            expect(fileSystem.readDirectory).toHaveBeenCalledWith(appConfig.PROMPTS_DIR);
            expect(fileSystem.isDirectory).toHaveBeenCalled();
            expect(fileSystem.readFileContent).toHaveBeenCalled();
        });

        it('should handle errors during prompt processing', async () => {
            const error = new Error('Processing failed');
            jest.mocked(fileSystem.readDirectory).mockRejectedValue(error);

            await expect(updatePromptMetadata()).rejects.toThrow('Processing failed');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle existing target directory during rename', async () => {
            const oldDir = 'old-prompt';
            const newDir = 'new-prompt';
            const promptFile = commonConfig.PROMPT_FILE_NAME;
            jest.mocked(fileSystem.fileExists).mockImplementation((filePath: string) => {
                if (filePath.includes('prompt.md')) {
                    return Promise.resolve(true);
                } else if (filePath.includes('metadata.yml')) {
                    return Promise.resolve(true);
                } else if (filePath.includes(newDir)) {
                    return Promise.resolve(true);
                } else {
                    return Promise.resolve(false);
                }
            });

            jest.mocked(fileSystem.readDirectory).mockImplementation((dirPath: string) => {
                if (dirPath === appConfig.PROMPTS_DIR) {
                    return Promise.resolve([oldDir]);
                } else if (dirPath.includes(oldDir)) {
                    return Promise.resolve([promptFile]);
                } else {
                    return Promise.resolve([]);
                }
            });

            jest.mocked(promptAnalyzer.processMetadataGeneration).mockResolvedValue({
                ...mockMetadata,
                directory: newDir
            });

            await updatePromptMetadata();

            expect(fileSystem.copyFile).toHaveBeenCalledWith(
                expect.stringContaining(path.join(oldDir, promptFile)),
                expect.stringContaining(path.join(newDir, promptFile))
            );

            expect(fileSystem.removeDirectory).toHaveBeenCalledWith(expect.stringContaining(oldDir));
        });

        it('should handle existing target directory during rename', async () => {
            const oldDir = 'old-prompt';
            const newDir = 'new-prompt';
            const promptFile = commonConfig.PROMPT_FILE_NAME;
            jest.mocked(fileSystem.fileExists).mockImplementation((filePath: string) => {
                if (filePath.includes('prompt.md')) {
                    return Promise.resolve(true);
                } else if (filePath.includes('metadata.yml')) {
                    return Promise.resolve(true);
                } else if (filePath.includes(newDir)) {
                    return Promise.resolve(true);
                } else {
                    return Promise.resolve(false);
                }
            });

            jest.mocked(fileSystem.readDirectory).mockImplementation((dirPath: string) => {
                if (dirPath === appConfig.PROMPTS_DIR) {
                    return Promise.resolve([oldDir]);
                } else if (dirPath.includes(oldDir)) {
                    return Promise.resolve([promptFile]);
                } else {
                    return Promise.resolve([]);
                }
            });

            jest.mocked(promptAnalyzer.processMetadataGeneration).mockResolvedValue({
                ...mockMetadata,
                directory: newDir
            });

            jest.mocked(fileSystem.isFile).mockResolvedValue(true);
            jest.mocked(fileSystem.isDirectory).mockResolvedValue(true);

            await updatePromptMetadata();

            expect(fileSystem.copyFile).toHaveBeenCalledWith(
                expect.stringContaining(path.join(oldDir, promptFile)),
                expect.stringContaining(path.join(newDir, promptFile))
            );
            expect(fileSystem.removeDirectory).toHaveBeenCalledWith(expect.stringContaining(oldDir));
        });
    });
});
