import { jest } from '@jest/globals';

import { getAIClient } from '../ai-client';
import { processPromptContent, updatePromptWithVariables } from '../prompt-processing';

jest.mock('../ai-client', () => ({
    getAIClient: jest.fn()
}));

jest.mock('../../../cli/utils/errors', () => ({
    handleError: jest.fn()
}));

jest.mock('chalk', () => ({
    blue: jest.fn((text) => text),
    green: jest.fn((text) => text),
    bold: jest.fn((text) => text)
}));

describe('PromptProcessingUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

        it('should handle variables with special characters', () => {
            const content = 'Hello {{specialName}}, welcome to {{specialPlace}}!';
            const variables = {
                specialName: 'John',
                specialPlace: 'Paris'
            };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Hello John, welcome to Paris!');
        });

        it('should handle complex content with multiple variables', () => {
            const content = `This is a {{type}} prompt with multiple {{variables}}.
It can span {{lines}} and include {{special_chars}}.`;
            const variables = {
                type: 'test',
                variables: 'placeholders',
                lines: 'multiple lines',
                special_chars: 'special characters like $, {}, [], etc.'
            };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe(`This is a test prompt with multiple placeholders.
It can span multiple lines and include special characters like $, {}, [], etc..`);
        });

        it('should handle empty variables object', () => {
            const content = 'Hello {{name}}!';
            const variables = {};
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Hello {{name}}!');
        });

        it('should handle content with no variables', () => {
            const content = 'Hello world!';
            const variables = { name: 'John' };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Hello world!');
        });

        it('should throw error for null or undefined content', () => {
            expect(() => {
                updatePromptWithVariables(null as unknown as string, {});
            }).toThrow('Content cannot be null or undefined');

            expect(() => {
                updatePromptWithVariables(undefined as unknown as string, {});
            }).toThrow('Content cannot be null or undefined');
        });

        it('should throw error if variable value is not a string', () => {
            const content = 'Hello {{name}}!';
            const variables = { name: 123 as any };
            expect(() => {
                updatePromptWithVariables(content, variables);
            }).toThrow('Variable value for key "name" must be a string');
        });

        it('should handle unresolved fragment references', () => {
            const content = 'Here is a fragment: {{fragment_var}}';
            const variables = {
                fragment_var: '<Failed to load fragment: category/name>'
            };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Here is a fragment: <Failed to load fragment: category/name>');
        });

        it('should handle unresolved env variables', () => {
            const content = 'Here is an env var: {{env_var}}';
            const variables = {
                env_var: '<Env var not found: TEST_VAR>'
            };
            const result = updatePromptWithVariables(content, variables);
            expect(result).toBe('Here is an env var: <Env var not found: TEST_VAR>');
        });
    });

    describe('processPromptContent', () => {
        const mockClient: any = {
            sendRequest: jest.fn(),
            sendStreamingRequest: jest.fn(),
            validateApiKey: jest.fn(),
            listAvailableModels: jest.fn()
        };
        beforeEach(() => {
            (getAIClient as jest.Mock).mockReturnValue(mockClient);
        });

        it('should throw an error if messages is not an array', async () => {
            await expect(processPromptContent(null as any)).rejects.toThrow('Messages must be a non-empty array');
        });

        it('should throw an error if messages array is empty', async () => {
            await expect(processPromptContent([])).rejects.toThrow('Messages must be a non-empty array');
        });

        it('should process content with sendRequest when useStreaming is false', async () => {
            const testMessages = [{ role: 'user', content: 'Hello' }];
            mockClient.sendRequest.mockResolvedValue({ content: 'Hi there!' });

            const result = await processPromptContent(testMessages, false);
            expect(result).toBe('Hi there!');
            expect(mockClient.sendRequest).toHaveBeenCalledWith(testMessages);
            expect(mockClient.sendStreamingRequest).not.toHaveBeenCalled();
        });

        it('should handle empty response from sendRequest', async () => {
            const testMessages = [{ role: 'user', content: 'Hello' }];
            mockClient.sendRequest.mockResolvedValue({ content: '' });

            const result = await processPromptContent(testMessages, false);
            expect(result).toBe('');
        });

        it('should process content with streaming when useStreaming is true', async () => {
            const testMessages = [{ role: 'user', content: 'Hello' }];
            mockClient.sendStreamingRequest.mockImplementation(async function* () {
                yield { type: 'content', content: 'Hi ' };
                yield { type: 'content', content: 'there!' };
                yield { type: 'other', content: undefined };
            });

            const result = await processPromptContent(testMessages, true);
            expect(result).toBe('Hi there!');
            expect(mockClient.sendStreamingRequest).toHaveBeenCalledWith(testMessages);
            expect(process.stdout.write).toHaveBeenCalledTimes(3);
            expect(process.stdout.write).toHaveBeenNthCalledWith(1, 'Hi ');
            expect(process.stdout.write).toHaveBeenNthCalledWith(2, 'there!');
            expect(process.stdout.write).toHaveBeenNthCalledWith(3, '\n');
        });

        it('should handle errors in streaming', async () => {
            const testMessages = [{ role: 'user', content: 'Hello' }];
            const streamError = new Error('Streaming failed');
            mockClient.sendStreamingRequest.mockImplementation(async function* () {
                yield { type: 'error' };
                throw streamError;
            });

            await expect(processPromptContent(testMessages, true)).rejects.toThrow(streamError);
        });

        it('should handle errors in non-streaming request', async () => {
            const testMessages = [{ role: 'user', content: 'Hello' }];
            const requestError = new Error('Request failed');
            mockClient.sendRequest.mockRejectedValue(requestError);

            await expect(processPromptContent(testMessages, false)).rejects.toThrow(requestError);
        });

        it('should not log to console when logging is false', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const testMessages = [{ role: 'user', content: 'Hello' }];
            mockClient.sendRequest.mockResolvedValue({ content: 'Hi there!' });

            await processPromptContent(testMessages, false, false);

            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });
});
