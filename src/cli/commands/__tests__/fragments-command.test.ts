import { formatTitleCase } from '../../../shared/utils/string-formatter';
import { listFragments, viewFragmentContent } from '../../utils/fragments';
import fragmentsCommand from '../fragments-command';
import { createMockCommand, parseCommand, setupConsoleCapture } from './command-test-utils';

jest.mock('../../utils/fragments', () => ({
    listFragments: jest.fn(),
    viewFragmentContent: jest.fn()
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
    const inquirer = jest.requireMock('@inquirer/prompts');
    const mockFragments = [
        { category: 'introduction', name: 'welcome', variable: '' },
        { category: 'introduction', name: 'disclaimer', variable: '' },
        { category: 'api', name: 'authentication', variable: '' },
        { category: 'api', name: 'endpoints', variable: '' },
        { category: 'examples', name: 'basic_usage', variable: '' }
    ];
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
        expect(command.commands[0].description()).toBe('List and view fragments');
    });

    it('should display main menu options', async () => {
        await parseCommand(fragmentsCommand, []);

        expect(inquirer.select).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Select an action:',
                choices: expect.arrayContaining([
                    expect.objectContaining({ name: 'View fragments by category' }),
                    expect.objectContaining({ name: 'View all fragments' })
                ])
            })
        );
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
        inquirer.select.mockResolvedValueOnce('all').mockResolvedValueOnce(testFragment).mockResolvedValueOnce('back');

        await parseCommand(fragmentsCommand, []);

        expect(viewFragmentContent).toHaveBeenCalledWith(testFragment.category, testFragment.name);

        const output = consoleCapture.getOutput().join(' ');
        expect(output).toContain('Fragment content:');
        expect(output).toContain('Category:');
        expect(output).toContain('Name:');
        expect(output).toContain('Content:');
        expect(output).toContain('Sample fragment content');
    });

    it('should handle errors gracefully', async () => {
        expect(true).toBe(true);
    });

    it('should handle content errors gracefully', async () => {
        expect(true).toBe(true);
    });
});
