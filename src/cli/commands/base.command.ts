import fs from 'fs';
import os from 'os';
import path from 'path';

import { editor, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';

import { ApiResult } from '../../shared/types';
import { cliConfig } from '../config/cli.config';
import { handleApiResult } from '../utils/database.util';
import { handleError } from '../utils/error.util';

type ActionMenuOptions<T> = {
    includeGoBack?: boolean;
    goBackValue?: T;
    goBackLabel?: string;
    clearConsole?: boolean;
};

export class BaseCommand extends Command {
    constructor(name: string, description: string) {
        super(name);
        this.description(description);
    }

    action(fn: (...args: any[]) => Promise<void> | void): this {
        return super.action(async (...args: any[]) => {
            try {
                await fn(...args);
            } catch (error) {
                this.handleError(error, `executing ${this.name()}`);
            }
        });
    }

    protected async showMenu<T>(
        message: string,
        choices: Array<{ name: string; value: T }>,
        options: ActionMenuOptions<T> = {}
    ): Promise<T> {
        const {
            includeGoBack = true,
            goBackValue = 'back' as T,
            goBackLabel = 'Go back',
            clearConsole = true
        } = options;

        if (clearConsole) {
            // console.clear();
        }

        const menuChoices = [...choices];

        if (includeGoBack) {
            menuChoices.push({
                name: chalk.red(chalk.bold(goBackLabel)),
                value: goBackValue
            });
        }
        return select<T>({
            message,
            pageSize: cliConfig.MENU_PAGE_SIZE,
            choices: menuChoices
        });
    }

    async runCommand(program: Command, commandName: string): Promise<void> {
        const command = program.commands.find((cmd) => cmd.name() === commandName);

        if (command) {
            try {
                await command.parseAsync([], { from: 'user' });
            } catch (error) {
                console.error(chalk.red(`Error executing command '${commandName}':`, error));
            }
        } else {
            console.error(chalk.red(`Command '${commandName}' not found.`));
        }
    }

    protected async handleApiResult<T>(result: ApiResult<T>, message: string): Promise<T | null> {
        return handleApiResult(result, message);
    }

    protected async getInput(message: string, validate?: (input: string) => boolean | string): Promise<string> {
        return input({
            message,
            validate: validate || ((value: string): boolean | string => value.trim() !== '' || 'Value cannot be empty')
        });
    }

    protected async getMultilineInput(
        message: string,
        initialValue: string = '',
        validate?: (input: string) => boolean | string
    ): Promise<string> {
        let tempDir: string | null = null;
        let tempFilePath: string | null = null;

        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-input-'));
            tempFilePath = path.join(tempDir, 'input.txt');
            fs.writeFileSync(tempFilePath, initialValue);

            console.log(chalk.cyan(message));

            let input = '';
            let isValid = false;
            while (!isValid) {
                try {
                    const fileContent = fs.readFileSync(tempFilePath, 'utf8');
                    input = await editor({
                        message: 'Edit your input',
                        default: fileContent,
                        postfix: '.txt',
                        waitForUseInput: true
                    });

                    fs.writeFileSync(tempFilePath, input);

                    if (validate) {
                        const validationResult = validate(input);

                        if (typeof validationResult === 'string') {
                            console.error(chalk.red(validationResult));
                            console.log(chalk.yellow('Press Enter to continue editing...'));
                            await new Promise((resolve) => process.stdin.once('data', resolve));
                        } else {
                            isValid = true;
                        }
                    } else {
                        isValid = true;
                    }
                } catch (error) {
                    console.error(chalk.red(`Error during editing: ${error}`));
                    console.log(chalk.yellow('Press Enter to retry...'));
                    await new Promise((resolve) => process.stdin.once('data', resolve));
                }
            }
            return input;
        } catch (error) {
            console.error(chalk.red(`Error in getMultilineInput: ${error}`));
            throw error;
        } finally {
            // Clean up
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            if (tempDir && fs.existsSync(tempDir)) {
                fs.rmdirSync(tempDir);
            }
        }
    }

    protected async pressKeyToContinue(): Promise<void> {
        await input({ message: 'Press a key to continue...' });
    }

    protected async confirmAction(message: string): Promise<boolean> {
        const action = await this.showMenu<'yes' | 'no'>(
            message,
            [
                { name: 'Yes', value: 'yes' },
                { name: 'No', value: 'no' }
            ],
            {
                includeGoBack: false
            }
        );
        return action === 'yes';
    }

    protected handleError(error: unknown, context: string): void {
        handleError(error, context);
    }
}
