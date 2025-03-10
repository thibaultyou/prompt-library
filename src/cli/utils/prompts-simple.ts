import { editor } from '@inquirer/prompts';
import chalk from 'chalk';

import { handleError } from './errors';

export { editor };

export async function editInEditor(
    content: string,
    options: {
        message?: string;
        postfix?: string;
    } = {}
): Promise<string> {
    try {
        const defaultMessage = 'Edit content in your editor';
        return await editor({
            message: options.message || defaultMessage,
            default: content,
            postfix: options.postfix || '.txt'
        });
    } catch (error) {
        handleError(error, 'opening editor');
        console.log(chalk.yellow('Editor failed to open. Returning original content.'));
        return content;
    }
}
