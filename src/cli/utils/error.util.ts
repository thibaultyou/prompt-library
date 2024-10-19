import chalk from 'chalk';

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
    console.error(chalk.red(`Error in ${context}:`));

    if (error instanceof AppError) {
        console.error(chalk.red(`Error in ${context}: [${error.code}] ${error.message}`));
    } else if (error instanceof Error) {
        console.error(chalk.red(`  Message: ${error.message}`));

        if (error.stack) {
            console.error(chalk.yellow(`  Stack trace:`));
            console.error(chalk.yellow(error.stack.split('\n').slice(1).join('\n')));
        }
    } else if (typeof error === 'string') {
        console.error(chalk.red(`  ${error}`));
    } else {
        console.error(chalk.red(`  Unknown error: ${JSON.stringify(error)}`));
    }

    console.error(chalk.cyan('\nIf this error persists, please report it to the development team.'));
}
