import { AppError } from '../../../cli/utils/errors';
import * as config from '../../config';
import { getAIClient, adaptAnthropicStreamEvent, adaptAnthropicResponse } from '../ai-client';

// Mock the imports that getAIClient uses
jest.mock('../anthropic-client', () => ({
    AnthropicClient: jest.fn().mockImplementation(() => ({
        mockAnthropicClient: true
    }))
}));

jest.mock('../openai-client', () => ({
    OpenAIClient: jest.fn().mockImplementation(() => ({
        mockOpenAIClient: true
    }))
}));

jest.mock('../../config');

describe('AI Client', () => {
    const mockGetConfigValue = jest.spyOn(config, 'getConfigValue');
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAIClient', () => {
        it('should return an Anthropic client when provider is anthropic', async () => {
            mockGetConfigValue.mockReturnValue('anthropic');

            const client = await getAIClient();
            expect(client).toEqual({ mockAnthropicClient: true });
        });

        it('should return an OpenAI client when provider is openai', async () => {
            mockGetConfigValue.mockReturnValue('openai');

            const client = await getAIClient();
            expect(client).toEqual({ mockOpenAIClient: true });
        });

        it('should throw an error for unsupported providers', async () => {
            mockGetConfigValue.mockReturnValue('invalid_provider');

            await expect(getAIClient()).rejects.toThrow(AppError);
            await expect(getAIClient()).rejects.toThrow('Unsupported AI provider: invalid_provider');
        });
    });

    describe('adaptAnthropicStreamEvent', () => {
        it('should adapt content_block_delta events with text', () => {
            // Mock the proper structure according to Anthropic SDK
            const event = {
                type: 'content_block_delta',
                index: 0,
                delta: { text: 'sample text' },
                content_block: { type: 'text' }
            };
            const adapted = adaptAnthropicStreamEvent(event as any);
            expect(adapted).toEqual({
                type: 'content',
                content: 'sample text'
            });
        });

        it('should return the event type for other events', () => {
            // Mock the proper structure according to Anthropic SDK
            const event = {
                type: 'message_start',
                message: { id: 'msg_123', type: 'message' }
            };
            const adapted = adaptAnthropicStreamEvent(event as any);
            expect(adapted).toEqual({ type: 'message_start' });
        });
    });

    describe('adaptAnthropicResponse', () => {
        it('should extract text content from an Anthropic message', () => {
            // Mock the proper structure according to Anthropic SDK
            const response = {
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'response content' }],
                model: 'claude-3',
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 20 }
            };
            const adapted = adaptAnthropicResponse(response as any);
            expect(adapted).toEqual({
                content: 'response content'
            });
        });

        it('should return empty content for invalid response format', () => {
            // Mock the proper structure according to Anthropic SDK
            const response = {
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                content: [],
                model: 'claude-3',
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 0 }
            };
            const adapted = adaptAnthropicResponse(response as any);
            expect(adapted).toEqual({
                content: ''
            });
        });
    });
});
