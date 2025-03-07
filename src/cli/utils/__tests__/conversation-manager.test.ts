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
            // Set up initial conversation
            const mockInitialPrompt = 'Initial system prompt';
            (getPromptFiles as jest.Mock).mockResolvedValue({
                success: true,
                data: { promptContent: mockInitialPrompt }
            });
            (resolveInputs as jest.Mock).mockResolvedValue({});

            // Prepare multiple user inputs and AI responses
            const firstUserInput = 'First user message';
            const secondUserInput = 'Second user message';
            const thirdUserInput = 'Third user message';
            const firstAIResponse = 'First AI response';
            const secondAIResponse = 'Second AI response';
            const thirdAIResponse = 'Third AI response';
            const fourthAIResponse = 'Fourth AI response';
            // Mock process content to return different responses for each call
            (processPromptContent as jest.Mock)
                .mockResolvedValueOnce(firstAIResponse) // For initialization
                .mockResolvedValueOnce(secondAIResponse) // For first continuation
                .mockResolvedValueOnce(thirdAIResponse) // For second continuation
                .mockResolvedValueOnce(fourthAIResponse); // For third continuation

            // Initialize conversation
            await conversationManager.initializeConversation({});

            // First continuation
            await conversationManager.continueConversation(firstUserInput);

            // Second continuation
            await conversationManager.continueConversation(secondUserInput);

            // Third continuation
            await conversationManager.continueConversation(thirdUserInput);

            // After three continuations, the messages array should contain the complete history
            // Get the actual messages passed to the last call of processPromptContent
            const lastCallArgs = (processPromptContent as jest.Mock).mock.calls[
                (processPromptContent as jest.Mock).mock.calls.length - 1
            ];
            const messages = lastCallArgs[0];
            // Verify the messages sequence (we can't use toHaveBeenLastCalledWith because of extra added message)
            expect(messages.length).toBe(8); // 1 initial + 3 user messages + 4 AI responses
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
            // There's an additional AI response that was added to the conversation at this point
            expect(messages[7].role).toBe('assistant');

            // Also verify useStreaming parameter
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
