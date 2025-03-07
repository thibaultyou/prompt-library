import * as errors from '../../../cli/utils/errors';
import * as config from '../../config';
import { OpenAIClient } from '../openai-client';

// Mock dependencies
jest.mock('openai');
jest.mock('../../config');
jest.mock('../../../cli/utils/errors', () => {
    const original = jest.requireActual('../../../cli/utils/errors');
    return {
        ...original,
        AppError: jest.fn().mockImplementation((code, message) => ({ code, message })),
        handleError: jest.fn()
    };
});

describe('OpenAIClient', () => {
    let client: OpenAIClient;
    const mockGetConfigValue = jest.spyOn(config, 'getConfigValue');
    const mockHandleError = jest.spyOn(errors, 'handleError');
    beforeEach(() => {
        jest.clearAllMocks();
        client = new OpenAIClient();

        // Mock the error handling functions
        mockHandleError.mockImplementation(() => {});
    });

    describe('getClient', () => {
        it('should throw an error if API key is not set', () => {
            mockGetConfigValue.mockImplementation((key) => {
                if (key === 'OPENAI_API_KEY') return undefined;
                return 'mock-value';
            });

            expect(() => {
                // @ts-expect-error - Access private method for testing
                client.getClient();
            }).toThrow();
            expect(errors.AppError).toHaveBeenCalledWith('CONFIG_ERROR', expect.any(String));
        });

        it('should throw an error if API key is empty', () => {
            mockGetConfigValue.mockImplementation((key) => {
                if (key === 'OPENAI_API_KEY') return '  ';
                return 'mock-value';
            });

            expect(() => {
                // @ts-expect-error - Access private method for testing
                client.getClient();
            }).toThrow();
            expect(errors.AppError).toHaveBeenCalledWith('CONFIG_ERROR', expect.any(String));
        });

        it('should create a new OpenAI client when API key is valid', () => {
            mockGetConfigValue.mockImplementation((key) => {
                if (key === 'OPENAI_API_KEY') return 'valid-api-key';
                return 'mock-value';
            });

            // @ts-expect-error - Access private method for testing
            const result = client.getClient();
            expect(result).toBeDefined();
        });
    });

    describe('sendRequest', () => {
        it('should format messages and return response content', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'test response' } }]
            };
            mockGetConfigValue.mockImplementation((key) => {
                if (key === 'OPENAI_API_KEY') return 'valid-api-key';

                if (key === 'OPENAI_MODEL') return 'gpt-4';

                if (key === 'OPENAI_MAX_TOKENS') return 1000;
                return 'mock-value';
            });

            // Set up mock create function
            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            // Replace the client's internal OpenAI instance with our mock
            // @ts-expect-error - Working with private property
            client.client = {
                chat: {
                    completions: {
                        create: mockCreate
                    } as any
                }
            } as any;

            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi' }
            ];
            const result = await client.sendRequest(messages);
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4',
                    max_tokens: 1000,
                    messages: [
                        { role: 'user', content: 'Hello' },
                        { role: 'assistant', content: 'Hi' }
                    ]
                })
            );

            expect(result).toEqual({
                content: 'test response'
            });
        });

        it('should handle errors properly', async () => {
            mockGetConfigValue.mockReturnValue('valid-api-key');

            const mockError = new Error('API error');
            const mockCreate = jest.fn().mockRejectedValue(mockError);
            // @ts-expect-error - Working with private property
            client.client = {
                chat: {
                    completions: {
                        create: mockCreate
                    } as any
                }
            } as any;

            await expect(client.sendRequest([{ role: 'user', content: 'test' }])).rejects.toThrow('API error');

            expect(mockHandleError).toHaveBeenCalledWith(mockError, expect.any(String));
        });
    });

    describe('validateApiKey', () => {
        it('should return true if API key is valid', async () => {
            const sendRequestSpy = jest.spyOn(client, 'sendRequest').mockResolvedValue({ content: 'Success' });
            const result = await client.validateApiKey();
            expect(sendRequestSpy).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false if API key validation fails', async () => {
            const error = new Error('Invalid API key');
            const sendRequestSpy = jest.spyOn(client, 'sendRequest').mockRejectedValue(error);
            const result = await client.validateApiKey();
            expect(sendRequestSpy).toHaveBeenCalled();
            expect(mockHandleError).toHaveBeenCalledWith(error, expect.any(String));
            expect(result).toBe(false);
        });
    });

    describe('listAvailableModels', () => {
        it('should return static model list if API key is not set', async () => {
            mockGetConfigValue.mockReturnValue('');

            // Silence console logs
            jest.spyOn(console, 'log').mockImplementation(() => {});

            const result = await client.listAvailableModels();
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('name');
        });

        it('should format models from API response', async () => {
            mockGetConfigValue.mockReturnValue('valid-api-key');

            const mockApiResponse = {
                data: [
                    { id: 'gpt-4' },
                    { id: 'gpt-3.5-turbo' },
                    { id: 'text-davinci-003' }, // Should be filtered out
                    { id: 'gpt-4o' }
                ]
            };
            const mockList = jest.fn().mockResolvedValue(mockApiResponse);
            // @ts-expect-error - Working with private property
            client.client = {
                models: {
                    list: mockList
                } as any
            } as any;

            const result = await client.listAvailableModels();
            expect(mockList).toHaveBeenCalled();
            // Should only include models with 'gpt' in the name
            expect(result.length).toBe(3);
            expect(result[0].id).toBe('gpt-4');
            expect(result[1].id).toBe('gpt-3.5-turbo');
            expect(result[2].id).toBe('gpt-4o');
        });

        it('should fall back to static list if API request fails', async () => {
            mockGetConfigValue.mockReturnValue('valid-api-key');

            const error = new Error('API error');
            const mockList = jest.fn().mockRejectedValue(error);
            // @ts-expect-error - Working with private property
            client.client = {
                models: {
                    list: mockList
                } as any
            } as any;

            // Silence console logs
            jest.spyOn(console, 'log').mockImplementation(() => {});

            const result = await client.listAvailableModels();
            expect(mockList).toHaveBeenCalled();
            expect(mockHandleError).toHaveBeenCalledWith(error, expect.any(String));
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('formatModelName', () => {
        it('should format model IDs correctly', () => {
            // @ts-expect-error - Access private method for testing
            expect(client.formatModelName('gpt-4')).toBe('GPT 4');
            // @ts-expect-error - Access private method for testing
            expect(client.formatModelName('gpt-3.5-turbo')).toBe('GPT 3.5 turbo');
            // @ts-expect-error - Access private method for testing
            expect(client.formatModelName('gpt-4-turbo-20240513')).toBe('GPT 4 turbo');
        });
    });

    describe('getContextWindowSize', () => {
        it('should return correct context window sizes for different models', () => {
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-4.5')).toBe(128000);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-4o')).toBe(128000);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-4-turbo')).toBe(128000);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-4')).toBe(8192);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-3.5-turbo-16k')).toBe(16384);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('gpt-3.5')).toBe(4096);
            // @ts-expect-error - Access private method for testing
            expect(client.getContextWindowSize('unknown-model')).toBe(4096);
        });
    });
});
