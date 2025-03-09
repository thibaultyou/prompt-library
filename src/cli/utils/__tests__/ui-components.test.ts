import { expect, describe, test, jest, beforeEach, afterEach } from '@jest/globals';
import chalk from 'chalk';

import {
    printSectionHeader,
    printExamples,
    successMessage,
    warningMessage,
    errorMessage,
    formatKeyValue,
    truncateString,
    showProgress
} from '../ui-components';

jest.mock('chalk', () => ({
    bold: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    green: jest.fn((str) => str),
    red: jest.fn((str) => str)
}));

jest.mock('cli-spinner', () => ({
    Spinner: jest.fn().mockImplementation(() => ({
        setSpinnerString: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
    }))
}));

describe('UI Components', () => {
    let consoleSpy: any;
    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    test('printSectionHeader should print a formatted header', () => {
        printSectionHeader('Test Header');

        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('Test Header'));
        expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('─'));
    });

    test('printExamples should print examples with proper formatting', () => {
        const examples = ['example 1', 'example 2'];
        printExamples(examples);

        expect(consoleSpy).toHaveBeenCalledTimes(4);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('Examples'));
        expect(consoleSpy).toHaveBeenNthCalledWith(2, '  example 1');
        expect(consoleSpy).toHaveBeenNthCalledWith(3, '  example 2');
    });

    test('successMessage should return a properly formatted success message', () => {
        const _result = successMessage('Test success');
        expect(chalk.green).toHaveBeenCalledWith('✅ Test success');
    });

    test('warningMessage should return a properly formatted warning message', () => {
        const _result = warningMessage('Test warning');
        expect(chalk.yellow).toHaveBeenCalledWith('⚠️ Test warning');
    });

    test('errorMessage should return a properly formatted error message', () => {
        const _result = errorMessage('Test error');
        expect(chalk.red).toHaveBeenCalledWith('❌ Test error');
    });

    test('formatKeyValue should format key-value pairs properly', () => {
        const _result = formatKeyValue('key', 'value');
        expect(chalk.cyan).toHaveBeenCalledWith('key');
    });

    test('truncateString should truncate strings longer than the max length', () => {
        expect(truncateString('short string', 20)).toBe('short string');
        expect(truncateString('this is a very long string that should be truncated', 20)).toBe('this is a very lo...');
    });

    test('showProgress should handle promise resolution correctly', async () => {
        const testPromise = Promise.resolve('test result');
        const result = await showProgress('Loading...', testPromise);
        expect(result).toBe('test result');
    });

    test('showProgress should handle promise rejection correctly', async () => {
        const testError = new Error('test error');
        const testPromise = Promise.reject(testError);
        await expect(showProgress('Loading...', testPromise)).rejects.toThrow(testError);
    });
});
