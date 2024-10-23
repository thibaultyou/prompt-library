import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages.js';

import { commonConfig } from '../../config/common-config';
import { sendAnthropicRequestClassic, sendAnthropicRequestStream, validateAnthropicApiKey } from '../anthropic-client';

jest.mock('@anthropic-ai/sdk');
jest.mock('../../../cli/utils/errors');
jest.mock('../../config/common-config');

describe('AnthropicClientUtils', () => {
    const testMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
    ];
    const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test response' }],
        model: 'claude-3',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
    } as Message;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    afterEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
    });

    describe('sendAnthropicRequestClassic', () => {
        it('should successfully send a classic request', async () => {
            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            const mockMessagesAPI = {
                create: mockCreate,
                stream: jest.fn()
            } as unknown as typeof Anthropic.prototype.messages;
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = mockMessagesAPI;

            const result = await sendAnthropicRequestClassic(testMessages);
            expect(result).toBe(mockResponse);
            expect(mockCreate).toHaveBeenCalledWith({
                model: commonConfig.ANTHROPIC_MODEL,
                max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
                messages: testMessages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });
        });

        it('should handle API errors properly', async () => {
            const mockError = new Error('API Error');
            const mockCreate = jest.fn().mockRejectedValue(mockError);
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                create: mockCreate,
                stream: jest.fn(),
                _client: {} as any
            } as any;

            await expect(sendAnthropicRequestClassic(testMessages)).rejects.toThrow(mockError);
        });
    });

    describe('sendAnthropicRequestStream', () => {
        it('should successfully stream responses', async () => {
            const mockStreamEvents: MessageStreamEvent[] = [
                {
                    type: 'message_start',
                    message: {
                        id: 'msg_123',
                        type: 'message',
                        role: 'assistant',
                        content: [],
                        model: 'claude-3',
                        stop_reason: null,
                        stop_sequence: null,
                        usage: { input_tokens: 0, output_tokens: 0 }
                    }
                },
                { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
                { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Test' } },
                { type: 'content_block_stop', index: 0 },
                {
                    type: 'message_delta',
                    delta: {
                        stop_reason: 'end_turn',
                        stop_sequence: null
                    },
                    usage: { output_tokens: 1 }
                },
                { type: 'message_stop' }
            ];
            const mockStream = {
                [Symbol.asyncIterator]: async function* (): AsyncIterableIterator<MessageStreamEvent> {
                    for (const event of mockStreamEvents) {
                        yield event;
                    }
                }
            };
            const mockStreamFn = jest.fn().mockReturnValue(mockStream);
            const mockMessagesAPI = {
                stream: mockStreamFn,
                create: jest.fn()
            } as unknown as typeof Anthropic.prototype.messages;
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = mockMessagesAPI;

            const events: MessageStreamEvent[] = [];

            for await (const event of sendAnthropicRequestStream(testMessages)) {
                events.push(event);
            }

            expect(events).toEqual(mockStreamEvents);
            expect(mockStreamFn).toHaveBeenCalledWith({
                model: commonConfig.ANTHROPIC_MODEL,
                max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
                messages: testMessages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });
        });

        it('should handle streaming errors properly', async () => {
            const mockError = new Error('Stream Error');
            const mockStreamFn = jest.fn().mockImplementation(() => {
                throw mockError;
            });
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                stream: mockStreamFn,
                create: jest.fn(),
                _client: {} as any
            } as any;

            const generator = sendAnthropicRequestStream(testMessages);
            await expect(generator.next()).rejects.toThrow(mockError);
        });
    });

    describe('validateAnthropicApiKey', () => {
        it('should return true for valid API key', async () => {
            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                create: mockCreate,
                stream: jest.fn(),
                _client: {} as any
            } as any;

            const result = await validateAnthropicApiKey();
            expect(result).toBe(true);
            expect(mockCreate).toHaveBeenCalledWith({
                model: commonConfig.ANTHROPIC_MODEL,
                max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
                messages: [{ role: 'user', content: 'Test request' }]
            });
        });

        it('should return false for invalid API key', async () => {
            const mockCreate = jest.fn().mockRejectedValue(new Error('Invalid API key'));
            (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                create: mockCreate,
                stream: jest.fn(),
                _client: {} as any
            } as any;

            const result = await validateAnthropicApiKey();
            expect(result).toBe(false);
        });
    });
});
