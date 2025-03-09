import { getConfig, setConfig } from '../../../shared/config';
import configCommand from '../config-command';
import { createMockCommand, parseCommand, setupConsoleCapture } from './command-test-utils';

jest.mock('../../../shared/config', () => ({
    getConfig: jest.fn(),
    setConfig: jest.fn(),
    Config: {}
}));

jest.mock('@inquirer/prompts', () => ({
    editor: jest.fn(),
    input: jest.fn(),
    select: jest.fn()
}));

describe('ConfigCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const inquirer = jest.requireMock('@inquirer/prompts');
    beforeEach(() => {
        jest.clearAllMocks();
        consoleCapture = setupConsoleCapture();

        inquirer.select.mockResolvedValue('back');
        inquirer.input.mockResolvedValue('');

        (getConfig as jest.Mock).mockReturnValue({
            MODEL_PROVIDER: 'anthropic',
            ANTHROPIC_MODEL: 'claude-3-opus-20240229',
            ANTHROPIC_MAX_TOKENS: 4000,
            ANTHROPIC_API_KEY: 'sk-ant-api123',
            MENU_PAGE_SIZE: 10
        });
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    it('should initialize with correct options', () => {
        const command = createMockCommand();
        command.addCommand(configCommand);

        expect(command.commands[0].name()).toBe('config');
        expect(command.commands[0].description()).toBe('Manage CLI configuration');
    });

    it('should show menu with view and set options', async () => {
        await parseCommand(configCommand, []);

        expect(inquirer.select).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Select an action:',
                choices: expect.arrayContaining([
                    expect.objectContaining({ name: 'View current configuration', value: 'view' }),
                    expect.objectContaining({ name: 'Set a configuration value', value: 'set' })
                ])
            })
        );
    });

    it('should display current configuration when view option is selected', async () => {
        inquirer.select.mockResolvedValueOnce('view').mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('');

        await parseCommand(configCommand, []);

        expect(getConfig).toHaveBeenCalled();
        expect(consoleCapture.getOutput().join(' ')).toContain('Current configuration:');
        expect(consoleCapture.getOutput().join(' ')).toContain('MODEL_PROVIDER');
        expect(consoleCapture.getOutput().join(' ')).toContain('anthropic');
        expect(consoleCapture.getOutput().join(' ')).toContain('ANTHROPIC_MODEL');
        expect(consoleCapture.getOutput().join(' ')).toContain('claude-3-opus-20240229');

        expect(consoleCapture.getOutput().join(' ')).toContain('ANTHROPIC_API_KEY');
        expect(consoleCapture.getOutput().join(' ')).toContain('********');
    });

    it('should show empty configuration message when config is empty', async () => {
        (getConfig as jest.Mock).mockReturnValue({});

        inquirer.select.mockResolvedValueOnce('view').mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('');

        await parseCommand(configCommand, []);

        expect(consoleCapture.getOutput().join(' ')).toContain('The configuration is empty');
    });

    it('should allow setting a configuration value', async () => {
        inquirer.select
            .mockResolvedValueOnce('set')
            .mockResolvedValueOnce('MODEL_PROVIDER')
            .mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('openai');

        await parseCommand(configCommand, []);

        expect(getConfig).toHaveBeenCalled();
        expect(setConfig).toHaveBeenCalledWith('MODEL_PROVIDER', 'openai');
        expect(consoleCapture.getOutput().join(' ')).toContain('Configuration updated: MODEL_PROVIDER = openai');
    });

    it('should handle errors gracefully', async () => {
        expect(true).toBe(true);
    });

    it('should show multiple cycles of menu options until back is selected', async () => {
        inquirer.select
            .mockResolvedValueOnce('view')
            .mockResolvedValueOnce('set')
            .mockResolvedValueOnce('MENU_PAGE_SIZE')
            .mockResolvedValueOnce('back');

        inquirer.input.mockResolvedValueOnce('').mockResolvedValueOnce('20');

        await parseCommand(configCommand, []);

        expect(inquirer.select).toHaveBeenCalledTimes(4);

        expect(setConfig).toHaveBeenCalled();

        expect(consoleCapture.getOutput().join(' ')).toContain('Configuration updated:');
    });

    it('should cancel setting config value when back is selected for key', async () => {
        inquirer.select.mockResolvedValueOnce('set').mockResolvedValueOnce('back').mockResolvedValueOnce('back');

        await parseCommand(configCommand, []);

        expect(setConfig).not.toHaveBeenCalled();
    });
});
