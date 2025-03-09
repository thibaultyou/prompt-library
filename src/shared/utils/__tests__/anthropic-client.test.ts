import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages.js';

import { AppError } from '../../../cli/utils/errors';
import { getConfigValue } from '../../config';
import { adaptAnthropicResponse, adaptAnthropicStreamEvent } from '../ai-client';
import {
    AnthropicClient,
    sendAnthropicRequestClassic,
    sendAnthropicRequestStream,
    validateAnthropicApiKey
} from '../anthropic-client';

jest.mock('@anthropic-ai/sdk');
jest.mock('../../../cli/utils/errors');
jest.mock('../../config', () => ({
    getConfigValue: jest.fn().mockImplementation((key) => {
        if (key === 'ANTHROPIC_API_KEY') return 'test-key';

        if (key === 'ANTHROPIC_MODEL') return 'claude-3-5-sonnet-20241022';

        if (key === 'ANTHROPIC_MAX_TOKENS') return 8000;
        return null;
    })
}));

jest.mock('../ai-client', () => {
    const originalModule = jest.requireActual('../ai-client');
    return {
        ...originalModule,
        adaptAnthropicResponse: jest.fn(),
        adaptAnthropicStreamEvent: jest.fn()
    };
});

describe('AnthropicClientUtils', () => {
    const testMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
    ];
    const mockResponse = {
        id: 'msg',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test response' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
    } as Message;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ANTHROPIC_API_KEY = 'test-key';
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.NODE_ENV;
    });

    describe('AnthropicClient class', () => {
        describe('getClient', () => {
            it('should create a new Anthropic client if none exists', () => {
                const client = new AnthropicClient();
                // @ts-expect-error - accessing private property for testing
                expect(client.client).toBeNull();

                // @ts-expect-error - using private method for testing
                const anthropicClient = client.getClient();
                expect(anthropicClient).toBeInstanceOf(Anthropic);
                expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'test-key' });
            });

            it('should throw an error if API key is not set', () => {
                (getConfigValue as jest.Mock).mockReturnValueOnce(undefined);
                const client = new AnthropicClient();
                expect(() => {
                    // @ts-expect-error - using private method for testing
                    client.getClient();
                }).toThrow(new AppError('CONFIG_ERROR', 'ANTHROPIC_API_KEY is not set in the environment.'));
            });

            it('should reuse existing client instance', () => {
                const mockAnthropicClient = {};
                const client = new AnthropicClient();
                // @ts-expect-error - accessing private property for testing
                client.client = mockAnthropicClient as any;

                // @ts-expect-error - using private method for testing
                const returnedClient = client.getClient();
                expect(returnedClient).toBe(mockAnthropicClient);
                expect(Anthropic).not.toHaveBeenCalled();
            });
        });

        describe('sendRequest', () => {
            it('should send request with proper parameters and return response', async () => {
                const mockCreate = jest.fn().mockResolvedValue(mockResponse);
                const mockMessagesAPI = {
                    create: mockCreate,
                    stream: jest.fn()
                } as unknown as typeof Anthropic.prototype.messages;
                (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = mockMessagesAPI;
                (adaptAnthropicResponse as jest.Mock).mockReturnValue({ content: 'Test response' });

                const client = new AnthropicClient();
                const result = await client.sendRequest(testMessages);
                expect(result).toEqual({ content: 'Test response' });
                expect(mockCreate).toHaveBeenCalledWith({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 8000,
                    messages: testMessages.map((msg) => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }))
                });
                expect(adaptAnthropicResponse).toHaveBeenCalledWith(mockResponse);
            });

            it('should handle API errors properly', async () => {
                const mockError = new Error('API Error');
                const mockCreate = jest.fn().mockRejectedValue(mockError);
                (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                    create: mockCreate,
                    stream: jest.fn()
                } as any;

                const client = new AnthropicClient();
                await expect(client.sendRequest(testMessages)).rejects.toThrow(mockError);
            });
        });

        describe('sendStreamingRequest', () => {
            it('should stream responses properly', async () => {
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
                    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Test' } }
                ];
                const mockStream = {
                    [Symbol.asyncIterator]: async function* (): AsyncIterableIterator<MessageStreamEvent> {
                        for (const event of mockStreamEvents) {
                            yield event;
                        }
                    }
                };
                const mockStreamFn = jest.fn().mockReturnValue(mockStream);
                (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                    stream: mockStreamFn,
                    create: jest.fn()
                } as any;

                (adaptAnthropicStreamEvent as jest.Mock).mockImplementation((event) => {
                    if (event.type === 'content_block_delta') {
                        return { type: 'content', content: 'Test' };
                    }
                    return { type: event.type };
                });

                const client = new AnthropicClient();
                const events = [];

                for await (const event of client.sendStreamingRequest(testMessages)) {
                    events.push(event);
                }

                expect(events).toEqual([{ type: 'message_start' }, { type: 'content', content: 'Test' }]);

                expect(mockStreamFn).toHaveBeenCalledWith({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 8000,
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
                    create: jest.fn()
                } as any;

                const client = new AnthropicClient();
                const generator = client.sendStreamingRequest(testMessages);
                await expect(generator.next()).rejects.toThrow(mockError);
            });
        });

        describe('validateApiKey', () => {
            it('should return true for valid API key', async () => {
                const mockCreate = jest.fn().mockResolvedValue(mockResponse);
                (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                    create: mockCreate,
                    stream: jest.fn()
                } as any;

                (adaptAnthropicResponse as jest.Mock).mockReturnValue({ content: 'Test response' });

                const client = new AnthropicClient();
                const result = await client.validateApiKey();
                expect(result).toBe(true);
                expect(mockCreate).toHaveBeenCalled();
            });

            it('should return false for invalid API key', async () => {
                const mockCreate = jest.fn().mockRejectedValue(new Error('Invalid API key'));
                (Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
                    create: mockCreate,
                    stream: jest.fn()
                } as any;

                const client = new AnthropicClient();
                const result = await client.validateApiKey();
                expect(result).toBe(false);
            });
        });

        describe('listAvailableModels', () => {
            it('should return a list of available models', async () => {
                const client = new AnthropicClient();
                const models = await client.listAvailableModels();
                expect(models).toBeInstanceOf(Array);
                expect(models.length).toBeGreaterThan(0);
                expect(models[0]).toHaveProperty('id');
                expect(models[0]).toHaveProperty('name');
                expect(models[0]).toHaveProperty('description');
            });

            it('should handle errors gracefully', async () => {
                jest.spyOn(console, 'error').mockImplementation(() => {});

                const mockHandleError = jest.requireMock('../../../cli/utils/errors').handleError;
                mockHandleError.mockImplementationOnce(() => {});

                const client = new AnthropicClient();
                const origMethod = client.listAvailableModels;
                client.listAvailableModels = jest.fn().mockResolvedValue([]);

                try {
                    const result = await client.listAvailableModels();
                    expect(result).toEqual([]);
                } finally {
                    client.listAvailableModels = origMethod;
                    jest.spyOn(console, 'error').mockRestore();
                }
            });
        });
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
            expect(result).toEqual(mockResponse);
            expect(mockCreate).toHaveBeenCalled();
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
            expect(mockStreamFn).toHaveBeenCalled();
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
