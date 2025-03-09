import * as configModule from '../../../shared/config';
import { getAIClient } from '../../../shared/utils/ai-client';
import modelCommand from '../model-command';
import { createMockCommand, parseCommand, setupConsoleCapture } from './command-test-utils';

jest.mock('../../../shared/config', () => ({
    getConfigValue: jest.fn(),
    setConfig: jest.fn(),
    Config: {}
}));

jest.mock('cli-spinner', () => ({
    Spinner: jest.fn().mockImplementation(() => ({
        setSpinnerString: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
    }))
}));

jest.mock('../../../shared/utils/ai-client', () => ({
    getAIClient: jest.fn()
}));

jest.mock('../../../shared/utils/anthropic-client', () => ({
    AnthropicClient: jest.fn().mockImplementation(() => ({
        listAvailableModels: jest.fn()
    }))
}));

jest.mock('../../../shared/utils/openai-client', () => ({
    OpenAIClient: jest.fn().mockImplementation(() => ({
        listAvailableModels: jest.fn()
    }))
}));

jest.mock('@inquirer/prompts', () => ({
    editor: jest.fn(),
    input: jest.fn(),
    select: jest.fn()
}));

describe('ModelCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const inquirer = jest.requireMock('@inquirer/prompts');
    const originalEnv = { ...process.env };
    beforeEach(() => {
        jest.clearAllMocks();
        consoleCapture = setupConsoleCapture();

        process.env = { ...originalEnv };

        (configModule.getConfigValue as jest.Mock).mockImplementation((key) => {
            switch (key) {
                case 'MODEL_PROVIDER':
                    return 'anthropic';
                case 'ANTHROPIC_MODEL':
                    return 'claude-3-opus-20240229';
                case 'OPENAI_MODEL':
                    return 'gpt-4-turbo';
                case 'ANTHROPIC_MAX_TOKENS':
                    return 4000;
                case 'OPENAI_MAX_TOKENS':
                    return 2000;
                case 'ANTHROPIC_API_KEY':
                    return 'sk-ant-mock123';
                case 'OPENAI_API_KEY':
                    return 'sk-openai-mock123';
                default:
                    return '';
            }
        });

        (getAIClient as jest.Mock).mockResolvedValue({
            listAvailableModels: jest.fn().mockResolvedValue([
                {
                    id: 'claude-3-opus-20240229',
                    name: 'Claude 3 Opus',
                    description: 'Most powerful model',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-sonnet-20240229',
                    name: 'Claude 3 Sonnet',
                    description: 'Balanced model',
                    contextWindow: 180000
                },
                {
                    id: 'claude-3-haiku-20240307',
                    name: 'Claude 3 Haiku',
                    description: 'Fast model',
                    contextWindow: 150000
                }
            ])
        });

        inquirer.select.mockResolvedValue('back');
    });

    afterEach(() => {
        consoleCapture.restore();
        process.env = originalEnv;
    });

    it('should initialize with correct options', () => {
        const command = createMockCommand();
        command.addCommand(modelCommand);

        expect(command.commands[0].name()).toBe('model');
        expect(command.commands[0].description()).toBe('Configure AI model settings');
    });

    it('should display current model configuration', async () => {
        inquirer.select.mockResolvedValue('back');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Current Configuration:');
        expect(consoleCapture.getOutput().join(' ')).toContain('Provider: anthropic');
        expect(consoleCapture.getOutput().join(' ')).toContain('Model: claude-3-opus-20240229');
        expect(consoleCapture.getOutput().join(' ')).toContain('Max Tokens: 4000');
    });

    it('should show the current model configuration correctly', async () => {
        process.env.MODEL_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_MODEL = 'claude-instant-1.2';

        inquirer.select.mockResolvedValue('back');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Current Configuration:');
        expect(consoleCapture.getOutput().join(' ')).toContain('Provider: anthropic');
        expect(consoleCapture.getOutput().join(' ')).toContain('Model: claude-3-opus-20240229');
    });

    it('should handle provider change', async () => {
        (configModule.getConfigValue as jest.Mock).mockImplementation((key) => {
            switch (key) {
                case 'MODEL_PROVIDER':
                    return 'openai';
                default:
                    return 'some-value';
            }
        });

        inquirer.select
            .mockResolvedValueOnce('provider')
            .mockResolvedValueOnce('anthropic')
            .mockResolvedValueOnce('back');

        await parseCommand(modelCommand, []);

        expect(configModule.setConfig).toHaveBeenCalledWith('MODEL_PROVIDER', 'anthropic');
        expect(consoleCapture.getOutput().join(' ')).toContain('AI provider changed to anthropic');
    });

    it('should prompt for API key if not set', async () => {
        (configModule.getConfigValue as jest.Mock).mockImplementation((key) => {
            if (key === 'ANTHROPIC_API_KEY') return '';
            return 'some-value';
        });

        inquirer.select
            .mockResolvedValueOnce('provider')
            .mockResolvedValueOnce('anthropic')
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('new-api-key');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Warning: ANTHROPIC_API_KEY is not set');
        expect(inquirer.input).toHaveBeenCalled();
        expect(configModule.setConfig).toHaveBeenCalledWith('ANTHROPIC_API_KEY', 'new-api-key');
    });

    it('should handle model change', async () => {
        inquirer.select
            .mockResolvedValueOnce('model')
            .mockResolvedValueOnce('claude-3-sonnet-20240229')
            .mockResolvedValueOnce('back');

        (getAIClient as jest.Mock).mockResolvedValue({
            listAvailableModels: jest.fn().mockResolvedValue([
                { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
                { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
                { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
            ])
        });

        await parseCommand(modelCommand, []);

        expect(configModule.setConfig).toHaveBeenCalledWith('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229');
        expect(consoleCapture.getOutput().join(' ')).toContain('Model changed to claude-3-sonnet-20240229');
    });

    it('should handle max tokens change', async () => {
        inquirer.select.mockResolvedValueOnce('max_tokens').mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('8000');

        await parseCommand(modelCommand, []);

        expect(configModule.setConfig).toHaveBeenCalledWith('ANTHROPIC_MAX_TOKENS', 8000);
        expect(consoleCapture.getOutput().join(' ')).toContain('Max tokens changed to 8000');
    });

    it('should handle input validation for max tokens', async () => {
        inquirer.select.mockResolvedValueOnce('max_tokens').mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('not-a-number');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Invalid input. Please enter a positive number');
        expect(configModule.setConfig).not.toHaveBeenCalledWith('ANTHROPIC_MAX_TOKENS', expect.anything());
    });

    it('should handle custom model input', async () => {
        inquirer.select.mockResolvedValueOnce('model').mockResolvedValueOnce('custom').mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('claude-custom-model');

        await parseCommand(modelCommand, []);

        expect(configModule.setConfig).toHaveBeenCalledWith('ANTHROPIC_MODEL', 'claude-custom-model');
        expect(consoleCapture.getOutput().join(' ')).toContain('Model changed to claude-custom-model');
    });

    it('should handle API errors when fetching models', async () => {
        (getAIClient as jest.Mock).mockRejectedValue(new Error('API connection failed'));

        inquirer.select.mockResolvedValueOnce('model').mockResolvedValueOnce('back');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Error fetching models');
    });

    it('should switch provider configuration when changing provider', async () => {
        inquirer.select.mockResolvedValueOnce('provider').mockResolvedValueOnce('openai').mockResolvedValueOnce('back');

        await parseCommand(modelCommand, []);

        expect(configModule.setConfig).toHaveBeenCalledWith('MODEL_PROVIDER', 'openai');
        expect(consoleCapture.getOutput().join(' ')).toContain('AI provider changed to openai');

        (configModule.getConfigValue as jest.Mock).mockImplementation((key) => {
            switch (key) {
                case 'MODEL_PROVIDER':
                    return 'openai';
                case 'OPENAI_MODEL':
                    return 'gpt-4-turbo';
                case 'OPENAI_MAX_TOKENS':
                    return 2000;
                case 'OPENAI_API_KEY':
                    return 'sk-openai-mock123';
                default:
                    return '';
            }
        });

        inquirer.select.mockResolvedValueOnce('model').mockResolvedValueOnce('back');

        await parseCommand(modelCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('Provider: openai');
    });
});
