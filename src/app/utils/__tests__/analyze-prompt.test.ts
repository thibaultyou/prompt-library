import logger from '../../../shared/utils/logger';
import { analyzePrompt } from '../analyze-prompt';
import { processMetadataGeneration } from '../metadata-generator';

jest.mock('../metadata-generator', () => ({
    processMetadataGeneration: jest.fn()
}));
jest.mock('../../../shared/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('AnalyzePromptUtils', () => {
    const mockPromptContent = 'Test prompt content';
    const mockMetadata = {
        title: 'Test Title',
        description: 'Detailed description',
        primary_category: 'Test Category',
        subcategories: ['sub1', 'sub2'],
        directory: 'test-dir',
        tags: ['tag1', 'tag2'],
        one_line_description: 'Test description',
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
        jest.clearAllMocks();
    });

    it('should analyze prompt successfully', async () => {
        (processMetadataGeneration as jest.Mock).mockResolvedValueOnce(mockMetadata);

        const result = await analyzePrompt(mockPromptContent);
        expect(result).toEqual(mockMetadata);
        expect(logger.info).toHaveBeenCalledWith('Starting prompt analysis');
        expect(logger.info).toHaveBeenCalledWith('Prompt analysis completed successfully');
    });

    it('should handle errors during analysis', async () => {
        const error = new Error('Analysis failed');
        (processMetadataGeneration as jest.Mock).mockRejectedValueOnce(error);

        await expect(analyzePrompt(mockPromptContent)).rejects.toThrow('Analysis failed');
        expect(logger.error).toHaveBeenCalledWith('Error analyzing prompt:', error);
    });
});
