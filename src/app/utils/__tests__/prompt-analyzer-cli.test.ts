import { readFileContent } from '../../../shared/utils/file-system';
import { analyzePrompt } from '../analyze-prompt';
import { runPromptAnalyzerFromCLI } from '../prompt-analyzer-cli';

jest.mock('../../../shared/utils/file-system');
jest.mock('../analyze-prompt', () => ({
    analyzePrompt: jest.fn()
}));

describe('PromptAnalyzerCLIUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runPromptAnalyzerFromCLI', () => {
        let mockExit: jest.SpyInstance;
        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(console, 'log').mockImplementation(() => {});
            mockExit = jest
                .spyOn(process, 'exit')
                .mockImplementation((_code?: number | string | null | undefined): never => undefined as never);
        });

        afterEach(() => {
            (console.error as jest.Mock).mockRestore();
            (console.log as jest.Mock).mockRestore();
            mockExit.mockRestore();
        });

        it('should read prompt file and analyze prompt', async () => {
            const mockPromptPath = '/path/to/prompt.txt';
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
            (readFileContent as jest.Mock).mockResolvedValueOnce(mockPromptContent);
            (analyzePrompt as jest.Mock).mockResolvedValueOnce(mockMetadata);

            await runPromptAnalyzerFromCLI([mockPromptPath]);

            expect(readFileContent).toHaveBeenCalledWith(mockPromptPath);
            expect(analyzePrompt).toHaveBeenCalledWith(mockPromptContent);
            expect(console.log).toHaveBeenCalledWith('Generated Metadata:');
            expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockMetadata, null, 2));

            expect(mockExit).toHaveBeenCalledWith(0);
        });

        it('should handle errors during processing', async () => {
            const mockPromptPath = '/path/to/prompt.txt';
            const error = new Error('Test error');
            (readFileContent as jest.Mock).mockRejectedValue(error);

            await runPromptAnalyzerFromCLI([mockPromptPath]);

            expect(console.error).toHaveBeenCalledWith('Error:', error);
            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });
});
