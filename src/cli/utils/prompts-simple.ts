import { editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { handleError } from './errors';

export { editor };

/**
 * Creates a file and opens it in the default editor.
 * @param content The initial content for the file
 * @param options Additional options for the editor
 * @returns The content after user edits it
 */
export async function editInEditor(content: string, options: {
    message?: string;
    postfix?: string;
} = {}): Promise<string> {
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