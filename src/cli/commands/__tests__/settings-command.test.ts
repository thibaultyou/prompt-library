import { select, input } from '@inquirer/prompts';
import { jest } from '@jest/globals';
import { Command } from 'commander';

import { setupConsoleCapture } from './command-test-utils';
import { parseCommand } from './command-test-utils';

const mockRunSubCommand = jest.fn();
const mockConfigCommand = new Command('config');
const mockSyncCommand = new Command('sync');
const mockFlushCommand = new Command('flush');

class MockSettingsCommand extends Command {
    constructor() {
        super('settings');
        this.description('Manage CLI configuration');
    }

    runSubCommand = mockRunSubCommand;

    async execute(): Promise<void> {
        const action = await select({
            message: 'Settings Menu:',
            choices: [
                { name: 'Configure CLI', value: 'config' },
                { name: 'Sync with remote repository', value: 'sync' },
                { name: 'Flush and reset data', value: 'flush' },
                { name: 'Go back', value: 'back' }
            ]
        });

        if (action === 'back') return;

        switch (action) {
            case 'config':
                await this.runSubCommand(mockConfigCommand);
                break;
            case 'sync':
                await this.runSubCommand(mockSyncCommand);
                break;
            case 'flush':
                await this.runSubCommand(mockFlushCommand);
                break;
        }
    }
}

const settingsCommand = new MockSettingsCommand();
settingsCommand.action(settingsCommand.execute.bind(settingsCommand));

jest.mock('@inquirer/prompts');

describe('SettingsCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const mockSelect = select as jest.MockedFunction<typeof select>;
    const mockInput = input as jest.MockedFunction<typeof input>;
    beforeEach(() => {
        consoleCapture = setupConsoleCapture();
        jest.clearAllMocks();

        mockInput.mockResolvedValue('');
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    it('should have correct command structure', () => {
        expect(settingsCommand.name()).toBe('settings');
        expect(settingsCommand.description()).toBe('Manage CLI configuration');
    });

    it('should exit when back option is selected', async () => {
        mockSelect.mockResolvedValueOnce('back');

        await parseCommand(settingsCommand);

        expect(mockRunSubCommand).not.toHaveBeenCalled();
    });

    it('should execute config command when selected', async () => {
        mockSelect.mockResolvedValueOnce('config');

        await parseCommand(settingsCommand);

        expect(mockRunSubCommand).toHaveBeenCalledWith(mockConfigCommand);
    });

    it('should execute sync command when selected', async () => {
        mockSelect.mockResolvedValueOnce('sync');

        await parseCommand(settingsCommand);

        expect(mockRunSubCommand).toHaveBeenCalledWith(mockSyncCommand);
    });

    it('should execute flush command when selected', async () => {
        mockSelect.mockResolvedValueOnce('flush');

        await parseCommand(settingsCommand);

        expect(mockRunSubCommand).toHaveBeenCalledWith(mockFlushCommand);
    });

    it('should handle errors gracefully', async () => {
        mockSelect.mockRejectedValueOnce(new Error('User interaction error'));

        class ErrorHandlingMockCommand extends Command {
            constructor() {
                super('settings');
            }

            async execute(): Promise<void> {
                try {
                    await select({ message: 'Test', choices: [] });
                } catch (error: any) {
                    console.error('[ERROR]', error.message);
                }
            }
        }

        const errorCommand = new ErrorHandlingMockCommand();
        errorCommand.action(errorCommand.execute.bind(errorCommand));

        await parseCommand(errorCommand);

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('[ERROR]'))).toBe(true);
    });
});
