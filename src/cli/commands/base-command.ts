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
import { formatMenuItem } from '../utils/ui-components';

export const LIBRARY_HOME_DIR = path.join(os.homedir(), '.prompt-library');

export const LIBRARY_REPO_DIR = path.join(LIBRARY_HOME_DIR, 'repository');

export const LIBRARY_PROMPTS_DIR = path.join(LIBRARY_REPO_DIR, 'prompts');

export const LIBRARY_FRAGMENTS_DIR = path.join(LIBRARY_REPO_DIR, 'fragments');

export class BaseCommand extends Command {
    constructor(name: string, description: string) {
        super(name);
        this.description(description);
    }

    protected async isLibraryRepositorySetup(): Promise<boolean> {
        try {
            const hasHomeDir = await fs.pathExists(LIBRARY_HOME_DIR);

            if (!hasHomeDir) return false;

            const hasGitDir = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (!hasGitDir) return false;

            const hasPromptsDir = await fs.pathExists(LIBRARY_PROMPTS_DIR);
            const hasFragmentsDir = await fs.pathExists(LIBRARY_FRAGMENTS_DIR);
            return hasPromptsDir && hasFragmentsDir;
        } catch (error) {
            this.handleError(error, 'checking library repository setup');
            return false;
        }
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
            nonInteractive?: boolean;
            defaultValue?: T;
        } = {}
    ): Promise<T> {
        const {
            includeGoBack = true,
            goBackValue = 'back' as T,
            goBackLabel = 'Go back',
            clearConsole = true,
            pageSize = cliConfig.MENU_PAGE_SIZE,
            nonInteractive = false,
            defaultValue
        } = options;

        if (clearConsole) {
            console.clear();
        }

        const menuChoices = [...choices];
        const processedChoices = menuChoices;

        if (includeGoBack) {
            processedChoices.push(formatMenuItem(goBackLabel, goBackValue, 'danger'));
        }

        // If non-interactive mode is requested or we detect we're in a CI environment,
        // return the default value to avoid UI interactions
        if (nonInteractive || process.env.CI === 'true') {
            if (defaultValue !== undefined) {
                console.log(chalk.cyan(`Using default selection: ${defaultValue}`));
                return defaultValue;
            } else if (processedChoices.length > 0 && processedChoices[0].value !== undefined) {
                console.log(chalk.cyan(`Auto-selecting first option in non-interactive mode`));
                return processedChoices[0].value;
            } else {
                return goBackValue;
            }
        }

        try {
            return await select<T>({
                message,
                choices: processedChoices as any,
                pageSize: pageSize
            });
        } catch (error) {
            // Handle the "User force closed" error gracefully
            if (error && error.toString().includes('User force closed the prompt')) {
                console.log(chalk.yellow('\nSelection cancelled. Using default option.'));
                
                // Return a sensible default if available
                if (defaultValue !== undefined) {
                    return defaultValue;
                } else if (includeGoBack) {
                    return goBackValue;
                } else if (processedChoices.length > 0) {
                    return processedChoices[0].value;
                }
            }
            
            // Re-throw other errors
            throw error;
        }
    }

    protected async handleApiResult<T>(result: ApiResult<T>, message: string): Promise<T | null> {
        return handleApiResult(result, message);
    }

    protected async getInput(
        message: string, 
        options: {
            validate?: (input: string) => boolean | string;
            default?: string;
            nonInteractive?: boolean;
        } = {}
    ): Promise<string> {
        const { 
            validate = ((value: string): boolean | string => value.trim() !== '' || 'Value cannot be empty'),
            default: defaultValue = '',
            nonInteractive = false
        } = options;
        
        // Handle non-interactive mode
        if (nonInteractive || process.env.CI === 'true') {
            if (defaultValue) {
                console.log(chalk.cyan(`Using default input: ${defaultValue}`));
                return defaultValue;
            } else {
                console.log(chalk.yellow('No default value provided in non-interactive mode'));
                return '';
            }
        }
        
        try {
            return await input({
                message,
                validate,
                default: defaultValue
            });
        } catch (error) {
            // Handle "User force closed" error
            if (error && error.toString().includes('User force closed the prompt')) {
                console.log(chalk.yellow('\nInput cancelled. Using default value.'));
                return defaultValue;
            }
            throw error;
        }
    }

    protected async getMultilineInput(
        message: string, 
        initialValue: string = '', 
        options: { 
            nonInteractive?: boolean 
        } = {}
    ): Promise<string> {
        const { nonInteractive = false } = options;
        
        // Handle non-interactive mode
        if (nonInteractive || process.env.CI === 'true') {
            console.log(chalk.cyan(`Using provided input in non-interactive mode`));
            return initialValue;
        }
        
        console.log(chalk.cyan(message));
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-input-'));
        const tempFilePath = path.join(tempDir, 'input.txt');

        try {
            const cleanedInitialValue =
                initialValue.startsWith(FRAGMENT_PREFIX) || initialValue.startsWith(ENV_PREFIX) ? '' : initialValue;
            await fs.writeFile(tempFilePath, cleanedInitialValue);
            
            try {
                const input = await editor({
                    message: 'Edit your input',
                    default: cleanedInitialValue,
                    waitForUseInput: false,
                    postfix: '.txt'
                });
                return input;
            } catch (error) {
                // Handle "User force closed" error
                if (error && error.toString().includes('User force closed the prompt')) {
                    console.log(chalk.yellow('\nEditor cancelled. Using initial value.'));
                    return cleanedInitialValue;
                }
                throw error;
            }
        } finally {
            await fs.remove(tempDir);
        }
    }

    protected async pressKeyToContinue(): Promise<void> {
        // Just return in CI mode
        if (process.env.CI === 'true') {
            return;
        }
        
        try {
            await input({ message: 'Press Enter to continue...' });
        } catch (error) {
            // Silently handle the "User force closed" error
            if (error && !error.toString().includes('User force closed the prompt')) {
                throw error;
            }
        }
    }

    protected async confirmAction(
        message: string, 
        options: { 
            nonInteractive?: boolean;
            defaultValue?: boolean;
        } = {}
    ): Promise<boolean> {
        const { 
            nonInteractive = false,
            defaultValue = false
        } = options;

        // Handle non-interactive mode
        if (nonInteractive || process.env.CI === 'true') {
            console.log(chalk.cyan(`Using default confirmation (${defaultValue ? 'yes' : 'no'}) in non-interactive mode`));
            return defaultValue;
        }

        const action = await this.showMenu<'yes' | 'no'>(
            message,
            [
                { name: 'Yes', value: 'yes' },
                { name: 'No', value: 'no' }
            ],
            { 
                includeGoBack: false,
                defaultValue: defaultValue ? 'yes' : 'no'
            }
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
