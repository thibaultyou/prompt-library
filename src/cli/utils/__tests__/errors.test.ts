import chalk from 'chalk';

import logger from '../../../shared/utils/logger';
import { AppError, handleError } from '../errors';

jest.mock('../../../shared/utils/logger');

describe('ErrorsUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('AppError', () => {
        it('should create an AppError with code and message', () => {
            const error = new AppError('TEST_ERROR', 'Test error message');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
            expect(error.code).toBe('TEST_ERROR');
            expect(error.message).toBe('Test error message');
            expect(error.name).toBe('AppError');
        });
    });

    describe('handleError', () => {
        const context = 'test context';
        it('should handle AppError', () => {
            const error = new AppError('TEST_ERROR', 'Test error message');
            handleError(error, context);

            expect(logger.error).toHaveBeenCalledWith('Error in test context:');
            expect(logger.error).toHaveBeenCalledWith('[TEST_ERROR] Test error message');
            expect(console.error).toHaveBeenCalledWith(
                chalk.red('Error in test context: [TEST_ERROR] Test error message')
            );
        });

        it('should handle standard Error with stack trace', () => {
            const error = new Error('Standard error');
            handleError(error, context);

            expect(logger.error).toHaveBeenCalledWith('Error in test context:');
            expect(logger.error).toHaveBeenCalledWith(error.message);
            expect(logger.debug).toHaveBeenCalledWith('Stack trace:', error.stack);
            expect(console.error).toHaveBeenCalledWith(chalk.red('  Message: Standard error'));
            expect(console.error).toHaveBeenCalledWith(chalk.yellow('  Stack trace:'));
        });

        it('should handle string error', () => {
            const errorMessage = 'String error message';
            handleError(errorMessage, context);

            expect(logger.error).toHaveBeenCalledWith('Error in test context:');
            expect(logger.error).toHaveBeenCalledWith(errorMessage);
            expect(console.error).toHaveBeenCalledWith(chalk.red(`  ${errorMessage}`));
        });

        it('should handle unknown error type', () => {
            const error = { custom: 'error' };
            handleError(error, context);

            expect(logger.error).toHaveBeenCalledWith('Error in test context:');
            expect(logger.error).toHaveBeenCalledWith(`Unknown error: ${JSON.stringify(error)}`);
            expect(console.error).toHaveBeenCalledWith(chalk.red(`  Unknown error: ${JSON.stringify(error)}`));
        });

        it('should always show the report message', () => {
            handleError('any error', context);

            expect(console.error).toHaveBeenCalledWith(
                chalk.cyan('\nIf this error persists, please report it to the development team.')
            );
        });
    });
});
