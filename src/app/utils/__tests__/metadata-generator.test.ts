import { readFileContent } from '../../../shared/utils/file-system';
import logger from '../../../shared/utils/logger';
import { processPromptContent } from '../../../shared/utils/prompt-processing';
import { appConfig } from '../../config/app-config';
import { listAvailableFragments } from '../fragment-manager';
import { loadAnalyzerPrompt, processMetadataGeneration } from '../metadata-generator';
import { parseYamlContent } from '../yaml-operations';

jest.mock('../fragment-manager');
jest.mock('../yaml-operations');
jest.mock('../../../shared/utils/file-system');
jest.mock('../../../shared/utils/prompt-processing', () => ({
    processPromptContent: jest.fn(),
    updatePromptWithVariables: jest.fn()
}));
jest.mock('../../config/app-config', () => ({
    appConfig: {
        ANALYZER_PROMPT_PATH: '/mock/analyzer/prompt.txt'
    }
}));
jest.mock('../analyze-prompt', () => ({
    analyzePrompt: jest.fn()
}));
jest.mock('../../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('MetadataGeneratorUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadAnalyzerPrompt', () => {
        it('should load analyzer prompt successfully', async () => {
            const mockContent = 'Mock analyzer prompt content';
            (readFileContent as jest.Mock).mockResolvedValue(mockContent);

            const result = await loadAnalyzerPrompt();
            expect(result).toBe(mockContent);
            expect(readFileContent).toHaveBeenCalledWith(appConfig.ANALYZER_PROMPT_PATH);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loading analyzer prompt'));
        });

        it('should handle errors when loading analyzer prompt', async () => {
            const error = new Error('Failed to read file');
            (readFileContent as jest.Mock).mockRejectedValue(error);

            await expect(loadAnalyzerPrompt()).rejects.toThrow('Failed to read file');
            expect(logger.error).toHaveBeenCalledWith('Error loading analyzer prompt:', error);
        });
    });

    describe('processMetadataGeneration', () => {
        const mockPromptContent = 'Test prompt content';
        const mockAnalyzerPrompt = 'Analyzer prompt';
        const mockFragments = '{"category": ["fragment1"]}';
        const mockProcessedContent = '<output>yaml: content</output>';
        const mockParsedMetadata = {
            title: 'Test Title',
            primary_category: 'Test Category',
            subcategories: ['sub1', 'sub2'],
            directory: 'test-dir',
            tags: ['tag1', 'tag2'],
            one_line_description: 'Test description',
            description: 'Detailed description',
            variables: [
                {
                    name: 'var1',
                    type: 'string',
                    role: 'system',
                    optional_for_user: false
                }
            ],
            content_hash: 'hash123',
            fragments: [
                {
                    name: 'fragment1',
                    category: 'test',
                    variable: 'TEST_VAR'
                }
            ]
        };
        beforeEach(() => {
            (readFileContent as jest.Mock).mockResolvedValue(mockAnalyzerPrompt);
            (listAvailableFragments as jest.Mock).mockResolvedValue(mockFragments);
            (processPromptContent as jest.Mock).mockResolvedValue(mockProcessedContent);
            (parseYamlContent as jest.Mock).mockReturnValue(mockParsedMetadata);
        });

        it('should generate metadata successfully', async () => {
            const result = await processMetadataGeneration(mockPromptContent);
            expect(result).toEqual(mockParsedMetadata);
            expect(listAvailableFragments).toHaveBeenCalled();
            expect(processPromptContent).toHaveBeenCalled();
            expect(parseYamlContent).toHaveBeenCalled();
        });

        it('should throw error for invalid metadata', async () => {
            const invalidMetadata = { ...mockParsedMetadata, title: '' };
            (parseYamlContent as jest.Mock).mockReturnValue(invalidMetadata);

            await expect(processMetadataGeneration(mockPromptContent)).rejects.toThrow('Invalid metadata generated');
        });

        it('should handle missing output tags', async () => {
            (processPromptContent as jest.Mock).mockResolvedValue('content without tags');
            await processMetadataGeneration(mockPromptContent);

            expect(logger.warn).toHaveBeenCalledWith('Output tags not found in content, returning trimmed content');
        });
    });
});
