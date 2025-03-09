import { select, input } from '@inquirer/prompts';
import { jest } from '@jest/globals';
import { Command } from 'commander';

import { setupConsoleCapture } from './command-test-utils';
import { getRecentExecutions } from '../../utils/database';
import { hasPrompts, hasFragments } from '../../utils/file-system';
import { showMainMenu } from '../menu-command';

jest.mock('@inquirer/prompts');
jest.mock('../../utils/file-system');
jest.mock('../../utils/database');

const mockGetConfig = jest.fn().mockReturnValue({
    REMOTE_REPOSITORY: 'https://github.com/example/repo'
});
jest.mock(
    '../../shared/config',
    () => ({
        getConfig: mockGetConfig
    }),
    { virtual: true }
);

describe('MenuCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const mockSelect = select as jest.MockedFunction<typeof select>;
    const mockInput = input as jest.MockedFunction<typeof input>;
    const mockHasPrompts = hasPrompts as jest.MockedFunction<typeof hasPrompts>;
    const mockHasFragments = hasFragments as jest.MockedFunction<typeof hasFragments>;
    const mockGetRecentExecutions = getRecentExecutions as jest.MockedFunction<typeof getRecentExecutions>;
    let mockProgram: Command;
    beforeEach(() => {
        consoleCapture = setupConsoleCapture();
        jest.clearAllMocks();
        jest.spyOn(console, 'clear').mockImplementation(() => {});

        mockInput.mockResolvedValue('');

        mockProgram = new Command();

        ['sync', 'prompts', 'fragments', 'model', 'env', 'settings'].forEach((cmd) => {
            const command = new Command(cmd);
            command.action(() => Promise.resolve());
            mockProgram.addCommand(command);
        });

        mockHasPrompts.mockResolvedValue(true);
        mockHasFragments.mockResolvedValue(true);

        mockGetRecentExecutions.mockResolvedValue([]);
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    it('should display main menu options and exit when back is selected', async () => {
        mockSelect.mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('Goodbye!'))).toBe(true);
    });

    it('should include sync option when no remote repository is configured', async () => {
        mockGetConfig.mockReturnValueOnce({
            REMOTE_REPOSITORY: ''
        });

        mockHasPrompts.mockResolvedValue(false);
        mockHasFragments.mockResolvedValue(false);

        mockSelect.mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        expect(mockSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                choices: expect.arrayContaining([expect.objectContaining({ value: 'sync' })])
            })
        );
    });

    it('should include sync option when no prompts or fragments exist', async () => {
        mockHasPrompts.mockResolvedValue(false);
        mockHasFragments.mockResolvedValue(false);

        mockSelect.mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        expect(mockSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                choices: expect.arrayContaining([expect.objectContaining({ value: 'sync' })])
            })
        );
    });

    it('should run selected command when option is chosen', async () => {
        mockSelect.mockResolvedValueOnce('prompts').mockResolvedValueOnce('back');

        const prompts = mockProgram.commands.find((cmd) => cmd.name() === 'prompts')!;
        const parseAsyncSpy = jest.spyOn(prompts, 'parseAsync').mockResolvedValue(prompts);
        await showMainMenu(mockProgram);

        expect(parseAsyncSpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        mockHasPrompts.mockRejectedValueOnce(new Error('File system error'));

        mockSelect.mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('[ERROR]'))).toBe(true);
    });

    it('should show Quick Actions when recent prompts are available', async () => {
        const mockRecentPrompts = [
            {
                id: 1,
                prompt_id: '123',
                execution_time: new Date().toISOString(),
                title: 'Test Prompt',
                primary_category: 'test'
            }
        ];
        mockGetRecentExecutions.mockResolvedValueOnce(mockRecentPrompts);

        mockSelect.mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        expect(mockGetRecentExecutions).toHaveBeenCalled();

        expect(mockSelect).toHaveBeenCalled();
    });

    it('should handle special action: last_prompt', async () => {
        const mockRecentPrompts = [
            {
                id: 1,
                prompt_id: '123',
                execution_time: new Date().toISOString(),
                title: 'Test Prompt',
                primary_category: 'test'
            }
        ];
        mockGetRecentExecutions.mockResolvedValueOnce(mockRecentPrompts);

        const executeCommand = new Command('execute');
        const parseAsyncSpy = jest.spyOn(executeCommand, 'parseAsync').mockResolvedValue(executeCommand);
        executeCommand.action(() => Promise.resolve());
        mockProgram.addCommand(executeCommand);

        mockSelect.mockResolvedValueOnce('last_prompt').mockResolvedValueOnce('back');

        await showMainMenu(mockProgram);

        expect(parseAsyncSpy).toHaveBeenCalled();
    });
});
