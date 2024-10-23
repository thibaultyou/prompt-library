import * as path from 'path';

import { jest } from '@jest/globals';
import * as nunjucks from 'nunjucks';

import { commonConfig } from '../../../shared/config/common-config';
import { PromptMetadata } from '../../../shared/types';
import * as fileSystem from '../../../shared/utils/file-system';
import logger from '../../../shared/utils/logger';
import { appConfig } from '../../config/app-config';
import { updateViews } from '../update-views';

jest.mock('nunjucks');
jest.mock('../../../shared/utils/file-system');
jest.mock('../../../shared/utils/logger');

describe('UpdateViewsController', () => {
    const mockPromptDir = 'test-prompt';
    const mockPromptPath = path.join(appConfig.PROMPTS_DIR, mockPromptDir);
    const mockMetadata: PromptMetadata = {
        title: 'Test Prompt',
        primary_category: 'Testing',
        one_line_description: 'A test prompt',
        subcategories: ['unit-test'],
        description: '',
        directory: '',
        tags: [],
        variables: []
    };
    const mockPromptContent = 'Test prompt content';
    const mockViewContent = 'Generated view content';
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fileSystem.isDirectory).mockResolvedValue(true);
        jest.mocked(fileSystem.readDirectory).mockResolvedValue([mockPromptDir]);
        jest.mocked(fileSystem.readFileContent).mockImplementation(async (filePath: string) => {
            if (filePath.endsWith(commonConfig.PROMPT_FILE_NAME)) {
                return mockPromptContent;
            }

            if (filePath.endsWith(commonConfig.METADATA_FILE_NAME)) {
                return JSON.stringify(mockMetadata);
            }
            return '';
        });
        jest.mocked(fileSystem.writeFileContent).mockResolvedValue();
        jest.mocked(nunjucks.render).mockImplementation(() => mockViewContent);
        jest.mocked(nunjucks.configure).mockReturnValue(new nunjucks.Environment());
    });

    it('should process prompt directories and generate views', async () => {
        await updateViews();
        expect(nunjucks.configure).toHaveBeenCalledWith(appConfig.TEMPLATES_DIR, { autoescape: false });
        expect(fileSystem.readDirectory).toHaveBeenCalledWith(appConfig.PROMPTS_DIR);

        expect(fileSystem.readFileContent).toHaveBeenCalledWith(
            path.join(mockPromptPath, commonConfig.PROMPT_FILE_NAME)
        );
        expect(fileSystem.readFileContent).toHaveBeenCalledWith(
            path.join(mockPromptPath, commonConfig.METADATA_FILE_NAME)
        );
        expect(nunjucks.render).toHaveBeenCalledWith(
            appConfig.VIEW_TEMPLATE_NAME,
            expect.objectContaining({
                metadata: mockMetadata,
                prompt_content: mockPromptContent
            })
        );
        expect(fileSystem.writeFileContent).toHaveBeenCalledWith(
            path.join(mockPromptPath, appConfig.VIEW_FILE_NAME),
            mockViewContent
        );
        expect(nunjucks.render).toHaveBeenCalledWith(
            appConfig.README_TEMPLATE_NAME,
            expect.objectContaining({
                categories: expect.any(Object)
            })
        );
    });

    it('should handle errors gracefully', async () => {
        const mockError = new Error('Test error');
        jest.mocked(fileSystem.readDirectory).mockRejectedValue(mockError);

        await expect(updateViews()).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalled();
    });

    it('should skip non-directory entries', async () => {
        jest.mocked(fileSystem.isDirectory).mockResolvedValue(false);

        await updateViews();

        expect(fileSystem.readFileContent).not.toHaveBeenCalled();
        expect(nunjucks.render).toHaveBeenCalledTimes(1);
    });

    it('should use default category when primary_category is missing', async () => {
        const metadataWithoutCategory: PromptMetadata = {
            ...mockMetadata,
            primary_category: appConfig.DEFAULT_CATEGORY
        };
        jest.mocked(fileSystem.readFileContent).mockImplementation(async (filePath: string) => {
            if (filePath.endsWith(commonConfig.METADATA_FILE_NAME)) {
                return JSON.stringify(metadataWithoutCategory);
            }
            return mockPromptContent;
        });

        await updateViews();

        expect(nunjucks.render).toHaveBeenCalledWith(
            appConfig.README_TEMPLATE_NAME,
            expect.objectContaining({
                categories: expect.objectContaining({
                    [appConfig.DEFAULT_CATEGORY]: expect.any(Array)
                })
            })
        );
    });
});
