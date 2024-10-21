import chalk from 'chalk';

import logger from '../../shared/utils/logger.util';

export class AppError extends Error {
    constructor(
        public code: string,
        message: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export function handleError(error: unknown, context: string): void {
    logger.error(`Error in ${context}:`);

    if (error instanceof AppError) {
        logger.error(`[${error.code}] ${error.message}`);
        console.error(chalk.red(`Error in ${context}: [${error.code}] ${error.message}`));
    } else if (error instanceof Error) {
        logger.error(error.message);
        console.error(chalk.red(`  Message: ${error.message}`));

        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
            console.error(chalk.yellow(`  Stack trace:`));
            console.error(chalk.yellow(error.stack.split('\n').slice(1).join('\n')));
        }
    } else if (typeof error === 'string') {
        logger.error(error);
        console.error(chalk.red(`  ${error}`));
    } else {
        const errorString = JSON.stringify(error);
        logger.error(`Unknown error: ${errorString}`);
        console.error(chalk.red(`  Unknown error: ${errorString}`));
    }

    console.error(chalk.cyan('\nIf this error persists, please report it to the development team.'));
}
