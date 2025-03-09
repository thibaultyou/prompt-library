import os from 'os';
import path from 'path';

import { editor, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';

import { ApiResult } from '../../shared/types';
import { cliConfig } from '../config/cli-config';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../constants';
import { handleApiResult } from '../utils/database';
import { handleError } from '../utils/errors';

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
        choices: Array<{ name: string; value: T; type?: string; description?: string; disabled?: boolean | string }>,
        options: {
            includeGoBack?: boolean;
            goBackValue?: T;
            goBackLabel?: string;
            clearConsole?: boolean;
            pageSize?: number;
        } = {}
    ): Promise<T> {
        const {
            includeGoBack = true,
            goBackValue = 'back' as T,
            goBackLabel = 'Go back',
            clearConsole = true,
            pageSize = cliConfig.MENU_PAGE_SIZE
        } = options;

        if (clearConsole) {
            console.clear();
        }

        const menuChoices = [...choices];
        const processedChoices = menuChoices;

        if (includeGoBack) {
            processedChoices.push({
                name: chalk.red(chalk.bold(goBackLabel)),
                value: goBackValue
            });
        }
        return select<T>({
            message,
            choices: processedChoices as any,
            pageSize: pageSize
        });
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

    protected async getMultilineInput(message: string, initialValue: string = ''): Promise<string> {
        console.log(chalk.cyan(message));
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-input-'));
        const tempFilePath = path.join(tempDir, 'input.txt');

        try {
            const cleanedInitialValue =
                initialValue.startsWith(FRAGMENT_PREFIX) || initialValue.startsWith(ENV_PREFIX) ? '' : initialValue;
            await fs.writeFile(tempFilePath, cleanedInitialValue);
            const input = await editor({
                message: 'Edit your input',
                default: cleanedInitialValue,
                waitForUseInput: false,
                postfix: '.txt'
            });
            return input;
        } finally {
            await fs.remove(tempDir);
        }
    }

    protected async pressKeyToContinue(): Promise<void> {
        await input({ message: 'Press Enter to continue...' });
    }

    protected async confirmAction(message: string): Promise<boolean> {
        const action = await this.showMenu<'yes' | 'no'>(
            message,
            [
                { name: 'Yes', value: 'yes' },
                { name: 'No', value: 'no' }
            ],
            { includeGoBack: false }
        );
        return action === 'yes';
    }

    protected handleError(error: unknown, context: string): void {
        handleError(error, context);
    }

    async runCommand(program: Command, commandName: string, options: { clearConsole?: boolean } = {}): Promise<void> {
        const { clearConsole = true } = options;
        const command = program.commands.find((cmd) => cmd.name() === commandName);

        if (clearConsole) {
            console.clear();
        }

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

    async runSubCommand(command: BaseCommand, options: { clearConsole?: boolean } = {}): Promise<void> {
        const { clearConsole = true } = options;

        if (clearConsole) {
            console.clear();
        }

        try {
            await command.parseAsync([], { from: 'user' });
        } catch (error) {
            this.handleError(error, `running ${command.name()} command`);
        }
    }
}
