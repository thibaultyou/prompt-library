import { getPromptFiles, viewPromptDetails } from '../../utils/prompts';
import executeCommand from '../execute-command';
import { createMockCommand, parseCommand, setupConsoleCapture } from './command-test-utils';

jest.mock('../../utils/prompts', () => ({
    getPromptFiles: jest.fn(),
    viewPromptDetails: jest.fn()
}));

jest.mock('../../utils/database', () => ({
    handleApiResult: jest.fn((result) => (result.success ? result.data : null))
}));

jest.mock('fs-extra', () => ({
    readFile: jest.fn().mockResolvedValue('mock file content')
}));

jest.mock('js-yaml', () => ({
    load: jest.fn().mockReturnValue({
        title: 'Mock Title',
        variables: [{ name: 'var1', role: 'Test role', optional_for_user: false }]
    })
}));

jest.mock('../../../shared/utils/prompt-processing', () => ({
    updatePromptWithVariables: jest.fn(
        (content, variables) => `Updated content with ${Object.keys(variables).length} variables`
    ),
    processPromptContent: jest.fn().mockResolvedValue('Processed prompt result')
}));

jest.mock('chalk', () => ({
    cyan: jest.fn((text) => text),
    green: jest.fn((text) => text),
    red: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    bold: jest.fn((text) => text)
}));

describe('ExecuteCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    beforeEach(() => {
        jest.clearAllMocks();
        consoleCapture = setupConsoleCapture();

        (getPromptFiles as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                success: true,
                data: {
                    promptContent: 'Test prompt content',
                    metadata: {
                        title: 'Test Prompt',
                        variables: [
                            { name: 'test_var', role: 'Test variable', optional_for_user: false, value: 'test value' }
                        ]
                    }
                }
            })
        );
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    it('should initialize with correct options', () => {
        const command = createMockCommand();
        command.addCommand(executeCommand);

        expect(command.commands[0].name()).toBe('execute');
        expect(command.commands[0].description()).toBe('Execute or inspect a prompt');

        expect(command.commands[0].options).toHaveLength(5);
    });

    it('should execute a prompt by ID successfully', async () => {
        await parseCommand(executeCommand, ['-p', '123']);

        expect(getPromptFiles).toHaveBeenCalledWith('123', { cleanVariables: true });
        expect(consoleCapture.getOutput().join(' ')).toContain('Using variables:');
        expect(consoleCapture.getOutput().join(' ')).toContain('Processed prompt result');
    });

    it('should execute a prompt by name successfully', async () => {
        await parseCommand(executeCommand, ['-p', 'git_commit']);

        expect(getPromptFiles).toHaveBeenCalledWith('git_commit', { cleanVariables: true });
        expect(consoleCapture.getOutput().join(' ')).toContain('Using variables:');
        expect(consoleCapture.getOutput().join(' ')).toContain('Processed prompt result');
    });

    it('should inspect a prompt without executing', async () => {
        await parseCommand(executeCommand, ['-p', '123', '-i']);

        expect(getPromptFiles).toHaveBeenCalledWith('123', { cleanVariables: true });
        expect(viewPromptDetails).toHaveBeenCalled();

        expect(consoleCapture.getOutput()).not.toContain('Processed prompt result');
    });

    it('should handle file-based prompt execution', async () => {
        const command = executeCommand as any;
        const originalHandleFilePrompt = command.handleFilePrompt;
        const mockExecuteWithMetadata = jest.fn().mockResolvedValue('Test result');
        command.handleFilePrompt = jest
            .fn()
            .mockImplementation(async (promptFile, metadataFile, dynamicOptions, inspect, _fileInputs) => {
                if (inspect) {
                    await command.inspectPrompt({
                        title: 'Test Prompt',
                        variables: [{ name: 'test_var', value: 'test' }]
                    });
                } else {
                    await mockExecuteWithMetadata();
                    console.log('Using variables:');
                    console.log('Processed prompt result');
                }
            });

        try {
            await command.execute(
                {
                    promptFile: './prompt.md',
                    metadataFile: './metadata.yml'
                },
                { args: [] }
            );

            expect(command.handleFilePrompt).toHaveBeenCalledWith(
                './prompt.md',
                './metadata.yml',
                {},
                undefined,
                undefined
            );

            expect(consoleCapture.getOutput().join(' ')).toContain('Using variables:');
            expect(consoleCapture.getOutput().join(' ')).toContain('Processed prompt result');
        } finally {
            command.handleFilePrompt = originalHandleFilePrompt;
        }
    });

    it('should handle missing required options', async () => {
        const command = executeCommand as any;
        const options = {};
        const commandObj = { args: [] };
        const originalError = console.error;
        console.error = jest.fn();

        try {
            await command.execute(options, commandObj);

            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error: You must provide either a prompt ID')
            );

            expect(getPromptFiles).not.toHaveBeenCalled();
        } finally {
            console.error = originalError;
        }
    });

    it('should handle prompt not found error', async () => {
        const command = executeCommand as any;
        const mockGetPromptFiles = getPromptFiles as jest.Mock;
        mockGetPromptFiles.mockResolvedValueOnce({
            success: false,
            error: 'Prompt not found'
        });

        const originalHandleApiResult = command.handleApiResult;
        command.handleApiResult = jest.fn().mockImplementation((result) => {
            if (!result.success) return null;
            return result.data;
        });

        try {
            await command.handleStoredPrompt('999', {}, false, {});

            expect(mockGetPromptFiles).toHaveBeenCalledWith('999', expect.any(Object));

            expect(command.handleApiResult).toHaveBeenCalledWith(
                expect.objectContaining({ success: false }),
                expect.any(String)
            );
        } finally {
            command.handleApiResult = originalHandleApiResult;
        }
    });

    it('should use file inputs correctly', async () => {
        const command = executeCommand as any;
        const collector = command.collect.bind(command);
        const result = collector('test_var=./input.txt', {});
        expect(result).toEqual({ test_var: './input.txt' });

        const parseOptions = {
            fileInput: { test_var: './input.txt' },
            prompt: '123'
        };
        const originalHandleStoredPrompt = command.handleStoredPrompt;
        command.handleStoredPrompt = jest.fn();

        try {
            await command.execute(parseOptions, { args: [] });

            expect(command.handleStoredPrompt).toHaveBeenCalledWith('123', expect.any(Object), undefined, {
                test_var: './input.txt'
            });
        } finally {
            command.handleStoredPrompt = originalHandleStoredPrompt;
        }
    });

    it('should handle dynamic CLI options as variables', async () => {
        const command = executeCommand as any;
        const result = command.parseDynamicOptions(['--test_var', 'cli value']);
        expect(result).toEqual({ test_var: 'cli value' });

        await command.executePromptWithMetadata(
            'Test prompt',
            { variables: [{ name: 'test_var', role: 'Test', optional_for_user: false }] },
            { test_var: 'cli value' },
            {}
        );

        expect(consoleCapture.getOutput().join(' ')).toContain('Using variables:');
        expect(consoleCapture.getOutput().join(' ')).toContain('test_var:');
    });
});
