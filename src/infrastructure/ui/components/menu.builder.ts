import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { Injectable, Scope } from '@nestjs/common';
import chalk from 'chalk';
import { Ora } from 'ora';

import { TextFormatter } from './text.formatter';
import { CANCEL_KEYWORDS, MENU_DISPLAY, MENU_NAVIGATION, SEPARATOR, STYLE_TYPES } from '../../../shared/constants';
import { MenuItem, MenuOptions, MenuConfig, MenuStyle, SpinnerWithStatus, StyleType } from '../../../shared/types';
import { EditorService } from '../services/editor.service';

@Injectable({ scope: Scope.DEFAULT })
export class MenuBuilder {
    constructor(
        private readonly textFormatter: TextFormatter,
        private readonly editorService: EditorService
    ) {}

    async selectMenu<T>(message: string, choices: MenuItem<T>[], options: MenuOptions<T> = {}): Promise<T> {
        const {
            pageSize = MENU_DISPLAY.PAGE_SIZE,
            loop = true,
            clearConsole = false,
            includeGoBack = true,
            goBackLabel = MENU_NAVIGATION.BACK.LABEL,
            goBackValue = MENU_NAVIGATION.BACK.VALUE as unknown as T,
            nonInteractive = false
        } = options;
        const processedChoices = choices.map((choice) => ({
            name: choice.name,
            value: choice.value,
            disabled: choice.disabled ? ' ' : undefined
        }));

        if (includeGoBack) {
            processedChoices.push({
                name: SEPARATOR.CHAR.repeat(SEPARATOR.LENGTH),
                value: 'separator' as any,
                disabled: ' '
            });
            processedChoices.push({ name: chalk.red(goBackLabel), value: goBackValue, disabled: undefined });
        }

        if (clearConsole) console.clear();

        if (nonInteractive) {
            if (options.defaultValue !== undefined) return options.defaultValue;

            const firstEnabled = processedChoices.find((c) => !c.disabled);
            return firstEnabled ? firstEnabled.value : goBackValue;
        }

        try {
            return await select<T>({
                message,
                choices: processedChoices as Array<{ name: string; value: T; disabled?: string }>,
                pageSize,
                loop
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.error(chalk.yellow('Selection cancelled.'));
                throw new Error('User cancelled selection');
            }

            console.error(chalk.red('Menu selection encountered an error:'), error);
            throw error;
        }
    }

    async selectWithHeaders<T>(config: MenuConfig<T>): Promise<T> {
        const cleanChoices = config.choices.map((choice) => {
            if (choice.type === 'header') {
                const headerName = String(choice.name);
                const parts = headerName.trim().split(' ');
                const emoji = parts[0];
                const text = parts.slice(1).join(' ');
                let style: MenuStyle = 'primary';

                if (headerName.includes('QUICK ACTIONS')) style = 'success';
                else if (headerName.includes('REPOSITORY')) style = 'warning';

                const formattedName = this.textFormatter.bold(`\n${emoji} ${text}`, style);
                return { ...choice, name: formattedName, disabled: ' ' };
            }
            return choice;
        });

        try {
            return await select<T>({
                ...config,
                choices: cleanChoices as unknown as Array<{ name: string; value: T }>
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.error(chalk.yellow('Selection cancelled.'));
                throw new Error('User cancelled selection');
            }

            console.error(chalk.red('Menu selection encountered an error:'), error);
            throw error;
        }
    }

    async getInput(message: string, defaultValue?: string, allowCancel: boolean = false): Promise<string | null> {
        try {
            const promptMessage = allowCancel ? `${message} (type 'cancel' to go back)` : message;
            const result = await input({ message: promptMessage, default: defaultValue });

            if (allowCancel && CANCEL_KEYWORDS.includes(result.toLowerCase())) {
                return null;
            }
            return result;
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.warn(chalk.yellow('Input cancelled.'));
                return null;
            }

            console.error(chalk.red('Input prompt encountered an error:'), error);
            throw error;
        }
    }

    async getMultilineInput(
        message: string,
        initialValue: string = '',
        options: { instructionMessage?: string; postfix?: string } = {}
    ): Promise<string> {
        const postfix = options.postfix || '.md';

        if (options.instructionMessage) {
            console.log(this.textFormatter.style(options.instructionMessage, STYLE_TYPES.WARNING));
        }

        const result = await this.editorService.editInEditor(initialValue, { message: message, postfix: postfix });
        return result.success && result.data !== undefined ? result.data : initialValue;
    }

    async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
        try {
            return await confirm({ message, default: defaultValue });
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.warn(chalk.yellow('Confirmation cancelled.'));
                return defaultValue;
            }

            console.error(chalk.red('Confirmation prompt encountered an error:'), error);
            throw error;
        }
    }

    showSpinner(message: string): SpinnerWithStatus {
        const oraInstance = this.textFormatter.createSpinner(message);
        const spinner = oraInstance as SpinnerWithStatus;
        const originalMessage = message;
        spinner.succeed = (text?: string): Ora =>
            oraInstance.succeed(this.textFormatter.successMessage(text || originalMessage));
        spinner.fail = (text?: string): Ora =>
            oraInstance.fail(this.textFormatter.errorMessage(text || originalMessage));
        spinner.start();
        return spinner;
    }

    async showProgress<T>(message: string, promise: Promise<T>): Promise<T> {
        const spinner = this.showSpinner(message);

        try {
            const result = await promise;
            spinner.succeed();
            return result;
        } catch (error) {
            spinner.fail();
            throw error;
        }
    }

    async pressKeyToContinue(message: string = 'Press any key to continue...'): Promise<void> {
        console.log(chalk.dim(`\n${message}`));
        return new Promise((resolve) => {
            const wasRaw = process.stdin.isRaw;

            if (process.stdin.isTTY) process.stdin.setRawMode(true);

            process.stdin.resume();
            process.stdin.once('data', () => {
                process.stdin.pause();

                if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw);

                resolve();
            });
        });
    }

    formatMenuItem<T>(text: string, value: T, type?: StyleType): MenuItem<T> {
        return this.textFormatter.formatMenuItem(text, value, type);
    }

    createSectionHeader<T>(text: string, emoji?: string, style: StyleType = 'primary'): MenuItem<T> {
        const headerMenuItem = this.textFormatter.createSectionHeader<T>(text, emoji, style);
        headerMenuItem.value = 'header' as unknown as T;
        return headerMenuItem;
    }

    createSeparator<T>(length?: number): MenuItem<T> {
        const separatorMenuItem = this.textFormatter.createSeparator<T>(length);
        separatorMenuItem.value = 'separator' as unknown as T;
        return separatorMenuItem;
    }

    async select<T = string>(message: string, choices: Array<string | MenuItem<T>>): Promise<T> {
        const menuItems = choices.map((choice) =>
            typeof choice === 'string' ? { name: choice, value: choice as unknown as T, type: 'item' as const } : choice
        );
        return this.selectMenu<T>(message, menuItems, { includeGoBack: false });
    }

    async multiSelect<T = string>(message: string, choices: Array<string | MenuItem<T>>): Promise<T[]> {
        try {
            const formattedChoices = choices.map((choice) => {
                if (typeof choice === 'string') return { name: choice, value: choice as unknown as T };

                const { type: _type, ...rest } = choice;
                return rest;
            });
            return await checkbox({ message, choices: formattedChoices as any });
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.warn(chalk.yellow('Multi-selection cancelled.'));
                return [];
            }

            console.error(this.textFormatter.errorMessage('Selection encountered an error.'));
            throw error;
        }
    }

    createPromptActionChoices<T = string>(options?: {
        isPromptFavorite?: boolean;
        hasConversationHistory?: boolean;
        canEditPrompt?: boolean;
    }): Array<MenuItem<T>> {
        const { isPromptFavorite = false, hasConversationHistory = false, canEditPrompt = true } = options || {};
        const choices: Array<MenuItem<any>> = [];
        choices.push(this.formatMenuItem('Execute prompt', 'execute', STYLE_TYPES.SUCCESS));
        choices.push(this.formatMenuItem('View prompt content', 'view_content', STYLE_TYPES.INFO));
        choices.push(
            this.formatMenuItem(
                isPromptFavorite ? 'Remove from favorites' : 'Add to favorites',
                isPromptFavorite ? 'unfavorite' : 'favorite',
                isPromptFavorite ? STYLE_TYPES.WARNING : STYLE_TYPES.SUCCESS
            )
        );

        if (hasConversationHistory) {
            choices.push(this.formatMenuItem('View conversation history', 'history', STYLE_TYPES.INFO));
        }

        if (canEditPrompt) {
            choices.push(this.formatMenuItem('Edit prompt', 'update', STYLE_TYPES.PRIMARY));
        }

        choices.push(this.formatMenuItem('Manage variables', 'variables', STYLE_TYPES.SECONDARY));
        choices.push(this.formatMenuItem('Clear all values', 'unset_all', STYLE_TYPES.WARNING));
        return choices as Array<MenuItem<T>>;
    }
}
