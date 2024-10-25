import { Message, RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages.js';
import { jest } from '@jest/globals';

import { sendAnthropicRequestClassic, sendAnthropicRequestStream } from '../anthropic-client';
import { updatePromptWithVariables, processPromptContent } from '../prompt-processing';

jest.mock('../anthropic-client');
const mockSendAnthropicRequestClassic = sendAnthropicRequestClassic as jest.MockedFunction<
    typeof sendAnthropicRequestClassic
>;
const mockSendAnthropicRequestStream = sendAnthropicRequestStream as jest.MockedFunction<
    typeof sendAnthropicRequestStream
>;
describe('PromptProcessingUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    describe('updatePromptWithVariables', () => {
        it('should replace variables in content with provided values', () => {
            const content = 'Hello {{name}}, welcome to {{place}}!';
            const variables = {
                name: 'John',
                place: 'Paris'
            };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Hello John, welcome to Paris!');
        });

        it('should handle multiple occurrences of the same variable', () => {
            const content = '{{name}} is {{name}}';
            const variables = { name: 'John' };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('John is John');
        });

        it('should handle empty variables object', () => {
            const content = 'Hello {{name}}!';
            const variables = {};
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Hello {{name}}!');
        });

        it('should throw error for null or undefined content', () => {
            expect(() => {
                updatePromptWithVariables(null as unknown as string, {});
            }).toThrow('Content cannot be null or undefined');
        });

        it('should throw error if variable value is not a string', () => {
            const content = 'Hello {{name}}!';
            const variables = { name: 123 as any };
            expect(() => {
                updatePromptWithVariables(content, variables);
            }).toThrow('Variable value for key "name" must be a string');
        });
    });

    describe('processPromptContent', () => {
        const mockMessages = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ];
        it('should process classic response correctly', async () => {
            const mockMessage: Message = {
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Test response' }],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 20 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const result = await processPromptContent(mockMessages, false, false);
            expect(result).toBe('Test response');
            expect(mockSendAnthropicRequestClassic).toHaveBeenCalledWith(mockMessages);
        });

        it('should process streaming response correctly', async () => {
            const mockStream = [
                { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } as const },
                { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' world' } as const }
            ];
            mockSendAnthropicRequestStream.mockImplementation(async function* () {
                for (const event of mockStream) {
                    yield event as RawMessageStreamEvent;
                }
            });

            const result = await processPromptContent(mockMessages, true, false);
            expect(result).toBe('Hello world');
            expect(mockSendAnthropicRequestStream).toHaveBeenCalledWith(mockMessages);
        });

        it('should handle complex message content', async () => {
            const mockMessage: Message = {
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Text content' },
                    {
                        type: 'tool_use',
                        id: 'tool_123',
                        name: 'calculator',
                        input: { expression: '2+2' }
                    }
                ],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 20 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const result = await processPromptContent(mockMessages, false, false);
            expect(result).toContain('Text content');
            expect(result).toContain('[Tool Use: calculator]');
            expect(result).toContain('Input: {"expression":"2+2"}');
        });

        it('should handle unknown block types in message content', async () => {
            const mockMessage: Message = {
                id: 'msg_456',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Known text' }, { type: 'unknown_type', data: 'Some data' } as any],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 15, output_tokens: 25 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const result = await processPromptContent(mockMessages, false, false);
            expect(result).toContain('Known text');
            expect(result).toContain(JSON.stringify({ type: 'unknown_type', data: 'Some data' }));
        });

        it('should handle invalid blocks in message content', async () => {
            const mockMessage: Message = {
                id: 'msg_789',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Valid text' }, null as any, undefined as any],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 20, output_tokens: 30 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const result = await processPromptContent(mockMessages, false, false);
            expect(result).toBe('Valid text');
        });

        it('should handle errors in classic mode', async () => {
            mockSendAnthropicRequestClassic.mockRejectedValue(new Error('API Error'));

            await expect(processPromptContent(mockMessages, false, false)).rejects.toThrow('API Error');
        });

        it('should handle errors in streaming mode', async () => {
            mockSendAnthropicRequestStream.mockImplementation(async function* () {
                yield { type: 'placeholder' } as unknown as RawMessageStreamEvent;
                throw new Error('Stream Error');
            });

            await expect(processPromptContent(mockMessages, true, false)).rejects.toThrow('Stream Error');
        });

        it('should throw error if messages array is empty', async () => {
            await expect(processPromptContent([], false, false)).rejects.toThrow('Messages must be a non-empty array');
        });

        it('should log messages when logging is true', async () => {
            const mockMessage: Message = {
                id: 'msg_101',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Logged response' }],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 5, output_tokens: 15 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            await processPromptContent(mockMessages, false, true);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('You:'));
            expect(consoleLogSpy).toHaveBeenCalledWith('Hi there!');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('AI:'));

            consoleLogSpy.mockRestore();
        });

        it('should return empty string if message content is empty', async () => {
            const mockMessage: Message = {
                id: 'msg_202',
                type: 'message',
                role: 'assistant',
                content: [],
                model: 'claude-2',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
            };
            mockSendAnthropicRequestClassic.mockResolvedValue(mockMessage);

            const result = await processPromptContent(mockMessages, false, false);
            expect(result).toBe('');
        });

        it('should process streaming response with partial_json correctly', async () => {
            const mockStream = [
                {
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'partial_json', partial_json: '{"key":' } as const
                },
                {
                    type: 'content_block_delta',
                    index: 1,
                    delta: { type: 'partial_json', partial_json: '"value"}' } as const
                }
            ];
            mockSendAnthropicRequestStream.mockImplementation(async function* () {
                for (const event of mockStream) {
                    yield event as RawMessageStreamEvent;
                }
            });

            const processStdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            const result = await processPromptContent(mockMessages, true, false);
            expect(result).toBe('{"key":"value"}');
            expect(mockSendAnthropicRequestStream).toHaveBeenCalledWith(mockMessages);

            expect(processStdoutWriteSpy).toHaveBeenCalledWith('{"key":');
            expect(processStdoutWriteSpy).toHaveBeenCalledWith('"value"}');

            processStdoutWriteSpy.mockRestore();
        });
    });
});
