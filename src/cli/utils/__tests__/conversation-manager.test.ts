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

        it('should properly maintain conversation history across multiple turns', async () => {
            const mockInitialPrompt = 'Initial system prompt';
            (getPromptFiles as jest.Mock).mockResolvedValue({
                success: true,
                data: { promptContent: mockInitialPrompt }
            });
            (resolveInputs as jest.Mock).mockResolvedValue({});

            const firstUserInput = 'First user message';
            const secondUserInput = 'Second user message';
            const thirdUserInput = 'Third user message';
            const firstAIResponse = 'First AI response';
            const secondAIResponse = 'Second AI response';
            const thirdAIResponse = 'Third AI response';
            const fourthAIResponse = 'Fourth AI response';
            (processPromptContent as jest.Mock)
                .mockResolvedValueOnce(firstAIResponse)
                .mockResolvedValueOnce(secondAIResponse)
                .mockResolvedValueOnce(thirdAIResponse)
                .mockResolvedValueOnce(fourthAIResponse);

            await conversationManager.initializeConversation({});

            await conversationManager.continueConversation(firstUserInput);

            await conversationManager.continueConversation(secondUserInput);

            await conversationManager.continueConversation(thirdUserInput);

            const lastCallArgs = (processPromptContent as jest.Mock).mock.calls[
                (processPromptContent as jest.Mock).mock.calls.length - 1
            ];
            const messages = lastCallArgs[0];
            expect(messages.length).toBe(8);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[1].content).toBe(firstAIResponse);
            expect(messages[2].role).toBe('user');
            expect(messages[2].content).toBe(firstUserInput);
            expect(messages[3].role).toBe('assistant');
            expect(messages[3].content).toBe(secondAIResponse);
            expect(messages[4].role).toBe('user');
            expect(messages[4].content).toBe(secondUserInput);
            expect(messages[5].role).toBe('assistant');
            expect(messages[5].content).toBe(thirdAIResponse);
            expect(messages[6].role).toBe('user');
            expect(messages[6].content).toBe(thirdUserInput);

            expect(messages[7].role).toBe('assistant');

            expect(lastCallArgs[1]).toBe(true);
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
