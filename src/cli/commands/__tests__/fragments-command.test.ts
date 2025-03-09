import { createMockCommand, parseCommand, setupConsoleCapture } from './command-test-utils';
import { formatTitleCase } from '../../../shared/utils/string-formatter';
import { listFragments, viewFragmentContent } from '../../utils/fragments';
import fragmentsCommandModule from '../fragments-command';

let fragmentsCommand: typeof fragmentsCommandModule;
const mockCreateParseAsync = jest.fn().mockResolvedValue(undefined);
const mockEditParseAsync = jest.fn().mockResolvedValue(undefined);
const mockDeleteParseAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('../fragment-commands', () => ({
    createCommand: {
        name: (): string => 'create',
        description: (): string => 'Create a new fragment',
        parseAsync: mockCreateParseAsync,
        commands: [],
        exitOverride: (): { exitOverride: () => void } => ({ exitOverride: (): void => {} }),
        command: (): { command: () => void } => ({ command: (): void => {} }),
        option: (): { option: () => void } => ({ option: (): void => {} })
    },
    editCommand: {
        name: (): string => 'edit',
        description: (): string => 'Edit an existing fragment',
        parseAsync: mockEditParseAsync,
        commands: [],
        exitOverride: (): { exitOverride: () => void } => ({ exitOverride: (): void => {} }),
        command: (): { command: () => void } => ({ command: (): void => {} }),
        option: (): { option: () => void } => ({ option: (): void => {} })
    },
    deleteCommand: {
        name: (): string => 'delete',
        description: (): string => 'Delete an existing fragment',
        parseAsync: mockDeleteParseAsync,
        commands: [],
        exitOverride: (): { exitOverride: () => void } => ({ exitOverride: (): void => {} }),
        command: (): { command: () => void } => ({ command: (): void => {} }),
        option: (): { option: () => void } => ({ option: (): void => {} })
    }
}));

jest.mock('../../utils/fragments', () => ({
    listFragments: jest.fn(),
    viewFragmentContent: jest.fn(),
    selectFragmentForEditing: jest.fn()
}));

jest.mock('../../../shared/utils/string-formatter', () => ({
    formatTitleCase: jest.fn((text) => text)
}));

jest.mock('@inquirer/prompts', () => ({
    editor: jest.fn(),
    input: jest.fn(),
    select: jest.fn()
}));

describe('FragmentsCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const inquirer = jest.requireMock('@inquirer/prompts') as {
        editor: jest.Mock;
        input: jest.Mock;
        select: jest.Mock;
    };
    const mockFragments = [
        { category: 'introduction', name: 'welcome', variable: '' },
        { category: 'introduction', name: 'disclaimer', variable: '' },
        { category: 'api', name: 'authentication', variable: '' },
        { category: 'api', name: 'endpoints', variable: '' },
        { category: 'examples', name: 'basic_usage', variable: '' }
    ];
    beforeAll(() => {
        fragmentsCommand = fragmentsCommandModule;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        consoleCapture = setupConsoleCapture();

        (listFragments as jest.Mock).mockResolvedValue({
            success: true,
            data: mockFragments
        });

        (viewFragmentContent as jest.Mock).mockResolvedValue({
            success: true,
            data: 'Sample fragment content'
        });

        inquirer.select.mockResolvedValue('back');
        inquirer.input.mockResolvedValue('');
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    it('should initialize with correct options', () => {
        const command = createMockCommand();
        command.addCommand(fragmentsCommand);

        expect(command.commands[0].name()).toBe('fragments');
        expect(command.commands[0].description()).toBe('Manage prompt fragments');

        const subcommands = command.commands[0].commands;
        expect(subcommands.some((cmd) => cmd.name() === 'create')).toBeTruthy();
        expect(subcommands.some((cmd) => cmd.name() === 'edit')).toBeTruthy();
        expect(subcommands.some((cmd) => cmd.name() === 'delete')).toBeTruthy();
    });

    it('should display main menu options', async () => {
        await parseCommand(fragmentsCommand, []);

        expect(inquirer.select).toHaveBeenCalled();

        const callArgs = inquirer.select.mock.calls[0][0];
        expect(callArgs.message).toBe('Select an action:');

        const categoryChoice = callArgs.choices.find((c: { value: string }) => c.value === 'category');
        const allChoice = callArgs.choices.find((c: { value: string }) => c.value === 'all');
        const createChoice = callArgs.choices.find((c: { value: string }) => c.value === 'create');
        const editChoice = callArgs.choices.find((c: { value: string }) => c.value === 'edit');
        const deleteChoice = callArgs.choices.find((c: { value: string }) => c.value === 'delete');
        expect(categoryChoice).toBeDefined();
        expect(allChoice).toBeDefined();
        expect(createChoice).toBeDefined();
        expect(editChoice).toBeDefined();
        expect(deleteChoice).toBeDefined();
    });

    it('should handle view all fragments option', async () => {
        inquirer.select.mockResolvedValueOnce('all').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(listFragments).toHaveBeenCalled();

        expect(inquirer.select).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Select a fragment to view:'
            })
        );
    });

    it('should handle view by category option', async () => {
        inquirer.select.mockResolvedValueOnce('category').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(listFragments).toHaveBeenCalled();

        expect(inquirer.select).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Select a category:'
            })
        );
    });

    it('should display fragments for a selected category', async () => {
        inquirer.select.mockResolvedValueOnce('category').mockResolvedValueOnce('api').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(formatTitleCase).toHaveBeenCalledWith(expect.any(String));

        expect(listFragments).toHaveBeenCalled();
    });

    it('should display fragment content when selected', async () => {
        const testFragment = { category: 'api', name: 'authentication', variable: '' };
        inquirer.select
            .mockResolvedValueOnce('all')
            .mockResolvedValueOnce(testFragment)
            .mockResolvedValueOnce('back')
            .mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(viewFragmentContent).toHaveBeenCalledWith(testFragment.category, testFragment.name);

        const output = consoleCapture.getOutput().join(' ');
        expect(output).toContain('Fragment content:');
        expect(output).toContain('Category:');
        expect(output).toContain('Name:');
        expect(output).toContain('Content:');
        expect(output).toContain('Sample fragment content');
    });

    it('should call create command when create action is selected', async () => {
        inquirer.select.mockResolvedValueOnce('create').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(mockCreateParseAsync).toHaveBeenCalledWith([]);
    });

    it('should call edit command when edit action is selected', async () => {
        inquirer.select.mockResolvedValueOnce('edit').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(mockEditParseAsync).toHaveBeenCalledWith([]);
    });

    it('should call delete command when delete action is selected', async () => {
        inquirer.select.mockResolvedValueOnce('delete').mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(mockDeleteParseAsync).toHaveBeenCalledWith([]);
    });

    it('should display edit/delete options after showing fragment content', async () => {
        const testFragment = { category: 'api', name: 'authentication', variable: '' };
        inquirer.select
            .mockResolvedValueOnce('all')
            .mockResolvedValueOnce(testFragment)
            .mockResolvedValueOnce('edit')
            .mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(mockEditParseAsync).toHaveBeenCalledWith(['-c', 'api', '-n', 'authentication']);
    });

    it('should call delete command when delete action is selected for a fragment', async () => {
        const testFragment = { category: 'api', name: 'authentication', variable: '' };
        inquirer.select
            .mockResolvedValueOnce('all')
            .mockResolvedValueOnce(testFragment)
            .mockResolvedValueOnce('delete')
            .mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(mockDeleteParseAsync).toHaveBeenCalledWith(['-c', 'api', '-n', 'authentication']);
    });

    it('should handle errors gracefully when listing fragments fails', async () => {
        (listFragments as jest.Mock).mockResolvedValueOnce({
            success: false,
            error: 'Failed to list fragments'
        });

        await parseCommand(fragmentsCommand, []);

        const output = consoleCapture.getOutput().join(' ');
        expect(output).not.toContain('Sample fragment content');
    });

    it('should handle errors gracefully when viewing fragment content fails', async () => {
        const testFragment = { category: 'api', name: 'authentication', variable: '' };
        inquirer.select.mockResolvedValueOnce('all').mockResolvedValueOnce(testFragment).mockResolvedValueOnce('back');

        (viewFragmentContent as jest.Mock).mockResolvedValueOnce({
            success: false,
            error: 'Failed to view fragment content'
        });

        await parseCommand(fragmentsCommand, []);

        const output = consoleCapture.getOutput().join(' ');
        expect(output).not.toContain('Sample fragment content');
    });
});
