import { processPromptContent } from '../../../shared/utils/prompt-processing';
import { ConversationManager } from '../conversation-manager';
import { resolveInputs } from '../input-resolver';
import { getPromptFiles } from '../prompts';

jest.mock('../prompts');
jest.mock('../input-resolver');
jest.mock('../../../shared/utils/prompt-processing');
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

describe('ConversationManagerUtils', () => {
    let conversationManager: ConversationManager;
    const mockPromptId = 'test-prompt';
    beforeEach(() => {
        conversationManager = new ConversationManager(mockPromptId);
        jest.clearAllMocks();
    });

    describe('initializeConversation', () => {
        it('should successfully initialize conversation with user inputs', async () => {
            const mockUserInputs = { key: 'value' };
            const mockResolvedInputs = { key: 'resolved-value' };
            const mockPromptContent = 'Hello {{key}}';
            const mockResponse = 'Assistant response';
            (getPromptFiles as jest.Mock).mockResolvedValue({
                success: true,
                data: { promptContent: mockPromptContent }
            });
            (resolveInputs as jest.Mock).mockResolvedValue(mockResolvedInputs);
            (processPromptContent as jest.Mock).mockResolvedValue(mockResponse);

            const result = await conversationManager.initializeConversation(mockUserInputs);
            expect(result).toEqual({
                success: true,
                data: mockResponse
            });
            expect(getPromptFiles).toHaveBeenCalledWith(mockPromptId);
            expect(resolveInputs).toHaveBeenCalledWith(mockUserInputs);
            expect(processPromptContent).toHaveBeenCalled();
        });

        it('should handle failed prompt files retrieval', async () => {
            (getPromptFiles as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Failed to get prompts'
            });

            const result = await conversationManager.initializeConversation({});
            expect(result).toEqual({
                success: false,
                error: 'Failed to get prompts'
            });
        });

        it('should handle errors during initialization', async () => {
            const mockError = new Error('Test error');
            (getPromptFiles as jest.Mock).mockRejectedValue(mockError);

            const result = await conversationManager.initializeConversation({});
            expect(result).toEqual({
                success: false,
                error: 'Failed to initialize conversation'
            });
        });
    });

    describe('continueConversation', () => {
        it('should successfully continue conversation', async () => {
            const mockUserInput = 'Hello';
            const mockResponse = 'Assistant response';
            (processPromptContent as jest.Mock).mockResolvedValue(mockResponse);

            const result = await conversationManager.continueConversation(mockUserInput);
            expect(result).toEqual({
                success: true,
                data: mockResponse
            });
            expect(processPromptContent).toHaveBeenCalled();
        });

        it('should handle errors during conversation continuation', async () => {
            const mockError = new Error('Test error');
            (processPromptContent as jest.Mock).mockRejectedValue(mockError);

            const result = await conversationManager.continueConversation('test');
            expect(result).toEqual({
                success: false,
                error: 'Failed to continue conversation'
            });
        });
    });
});
