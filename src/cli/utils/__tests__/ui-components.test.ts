import {
    formatKeyValue,
    getInput,
    printExamples,
    printSectionHeader,
    selectWithHeaders,
    showProgress,
    showSpinner,
    successMessage,
    truncateString,
    warningMessage,
    errorMessage
} from '../ui-components';

jest.mock('chalk', () => ({
    cyan: jest.fn((text) => `cyan:${text}`),
    green: jest.fn((text) => `green:${text}`),
    yellow: jest.fn((text) => `yellow:${text}`),
    red: jest.fn((text) => `red:${text}`),
    bold: jest.fn((text) => `bold:${text}`),
    gray: jest.fn((text) => `gray:${text}`),
    dim: jest.fn((text) => `dim:${text}`)
}));

jest.mock('cli-spinner', () => {
    const mockSpinnerInstance = {
        setSpinnerString: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
    };
    const MockSpinner = jest.fn(() => mockSpinnerInstance);
    return {
        Spinner: MockSpinner
    };
});

jest.mock('@inquirer/prompts', () => ({
    input: jest.fn().mockResolvedValue('test input'),
    select: jest.fn().mockResolvedValue('selected value')
}));

describe('UI Components', () => {
    let consoleLogSpy: jest.SpyInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('formatters', () => {
        it('should format key-value pairs', () => {
            const result = formatKeyValue('testKey', 'testValue');
            expect(result).toBe('cyan:testKey: testValue');
        });

        it('should format success messages', () => {
            const result = successMessage('operation completed');
            expect(result).toBe('green:✅ operation completed');
        });

        it('should format warning messages', () => {
            const result = warningMessage('proceed with caution');
            expect(result).toBe('yellow:⚠️ proceed with caution');
        });

        it('should format error messages', () => {
            const result = errorMessage('something went wrong');
            expect(result).toBe('red:❌ something went wrong');
        });

        it('should truncate strings correctly', () => {
            const shortString = 'short';
            const longString = 'this is a very long string that should be truncated';
            expect(truncateString(shortString)).toBe(shortString);
            expect(truncateString(longString)).toBe('this is a very long string that should be trunc...');
            expect(truncateString(longString, 10)).toBe('this is...');
            expect(truncateString('')).toBe('');
            expect(truncateString(undefined as any)).toBe('');
        });
    });

    describe('display functions', () => {
        it('should print section headers', () => {
            printSectionHeader('Test Section');

            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test Section'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^─+$/));
        });

        it('should print examples', () => {
            const examples = ['example 1', 'example 2'];
            printExamples(examples);

            expect(consoleLogSpy).toHaveBeenCalledTimes(4);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Examples'));
            expect(consoleLogSpy).toHaveBeenCalledWith('  example 1');
            expect(consoleLogSpy).toHaveBeenCalledWith('  example 2');
        });
    });

    describe('spinner functions', () => {
        it('should create and manage spinners correctly', async () => {
            const mockPromise = Promise.resolve('result');
            const result = await showProgress('Loading', mockPromise);
            const Spinner = jest.requireMock('cli-spinner').Spinner;
            expect(Spinner).toHaveBeenCalledWith('Loading %s');
            const spinnerInstance = Spinner.mock.results[0].value;
            expect(spinnerInstance.setSpinnerString).toHaveBeenCalledWith('|/-\\');
            expect(spinnerInstance.start).toHaveBeenCalled();
            expect(spinnerInstance.stop).toHaveBeenCalledWith(true);
            expect(result).toBe('result');
        });

        it('should handle errors in spinner promises', async () => {
            const mockError = new Error('Test error');
            const mockPromise = Promise.reject(mockError);
            await expect(showProgress('Loading', mockPromise)).rejects.toThrow(mockError);

            const Spinner = jest.requireMock('cli-spinner').Spinner;
            const spinnerInstance = Spinner.mock.results[0].value;
            expect(spinnerInstance.stop).toHaveBeenCalledWith(true);
        });

        it('should create interactive spinners with succeed/fail methods', () => {
            jest.clearAllMocks();

            const Spinner = jest.requireMock('cli-spinner').Spinner;
            const spinner = showSpinner('Processing');
            expect(Spinner).toHaveBeenCalledWith('Processing %s');
            const spinnerInstance = Spinner.mock.results[0].value;
            expect(spinnerInstance.setSpinnerString).toHaveBeenCalledWith('|/-\\');
            expect(spinnerInstance.start).toHaveBeenCalled();

            spinner.succeed('Success message');
            expect(spinnerInstance.stop).toHaveBeenCalledWith(true);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Success message'));

            consoleLogSpy.mockClear();

            spinner.fail('Failure message');
            expect(spinnerInstance.stop).toHaveBeenCalledWith(true);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Failure message'));
        });
    });

    describe('input functions', () => {
        it('should get input with default value', async () => {
            const inquirer = jest.requireMock('@inquirer/prompts');
            const result = await getInput('Enter value:', 'default');
            expect(inquirer.input).toHaveBeenCalledWith({
                message: 'Enter value:',
                default: 'default'
            });
            expect(result).toBe('test input');
        });
    });

    describe('select functions', () => {
        it('should handle header formatting in select menus', async () => {
            const inquirer = jest.requireMock('@inquirer/prompts');
            const config = {
                message: 'Select option:',
                choices: [
                    { name: '🚀 QUICK ACTIONS', disabled: 'HEADER' },
                    { name: 'Option 1', value: 'opt1' },
                    { name: '🔄 REPOSITORY', disabled: 'HEADER' },
                    { name: 'Option 2', value: 'opt2' },
                    { name: '📚 STANDARD CATEGORY', disabled: 'HEADER' },
                    { name: 'Option 3', value: 'opt3' }
                ]
            };
            await selectWithHeaders(config);

            expect(inquirer.select).toHaveBeenCalled();

            const calledConfig = inquirer.select.mock.calls[0][0];
            expect(calledConfig.choices[0].name).toContain('QUICK ACTIONS');
            expect(calledConfig.choices[0].disabled).toBe('');

            expect(calledConfig.choices[2].name).toContain('REPOSITORY');
            expect(calledConfig.choices[4].name).toContain('STANDARD CATEGORY');
        });
    });
});
