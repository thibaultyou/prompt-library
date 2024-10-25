import os from 'os';
import path from 'path';

import { editor, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';

import { CommandError, createCommandError } from '../commands/base-command';
import { cliConfig } from '../config/cli-config';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../constants';

export interface MenuChoice<T> {
    readonly name: string;
    readonly value: T;
}

export interface MenuOptions<T> {
    readonly includeGoBack?: boolean;
    readonly goBackValue?: T;
    readonly goBackLabel?: string;
    readonly clearConsole?: boolean;
    readonly pageSize?: number;
}

export interface InteractivePrompts {
    readonly showMenu: <T>(
        message: string,
        choices: ReadonlyArray<MenuChoice<T>>,
        options?: MenuOptions<T>
    ) => TE.TaskEither<CommandError, T>;

    readonly getInput: (
        message: string,
        initialValue?: string,
        validate?: (input: string) => boolean | string
    ) => TE.TaskEither<CommandError, string>;

    readonly getMultilineInput: (message: string, initialValue?: string) => TE.TaskEither<CommandError, string>;
}

export const createInteractivePrompts = (): InteractivePrompts => ({
    showMenu: <T>(message: string, choices: ReadonlyArray<MenuChoice<T>>, options: MenuOptions<T> = {}) => {
        const {
            includeGoBack = true,
            goBackValue = 'back' as T,
            goBackLabel = 'Go back',
            clearConsole = true,
            pageSize = cliConfig.MENU_PAGE_SIZE
        } = options;
        return TE.tryCatch(
            async () => {
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
                    choices: menuChoices,
                    pageSize
                });
            },
            (error) => createCommandError('PROMPT_ERROR', 'Failed to show menu', error)
        );
    },

    getInput: (message: string, initialValue = '', validate?) =>
        TE.tryCatch(
            () =>
                input({
                    message,
                    default: initialValue,
                    validate: validate || ((value: string) => value.trim() !== '' || 'Value cannot be empty')
                }),
            (error) => createCommandError('PROMPT_ERROR', 'Failed to get input', error)
        ),

    getMultilineInput: (message: string, initialValue = '') =>
        TE.tryCatch(
            async () => {
                console.log(chalk.cyan(message));
                const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-input-'));
                const tempFilePath = path.join(tempDir, 'input.txt');

                try {
                    const cleanedInitialValue =
                        initialValue.startsWith(FRAGMENT_PREFIX) || initialValue.startsWith(ENV_PREFIX)
                            ? ''
                            : initialValue;
                    await fs.writeFile(tempFilePath, cleanedInitialValue);
                    return editor({
                        message: 'Edit your input',
                        default: cleanedInitialValue,
                        waitForUseInput: false,
                        postfix: '.txt'
                    });
                } finally {
                    await fs.remove(tempDir);
                }
            },
            (error) => createCommandError('PROMPT_ERROR', 'Failed to get multiline input', error)
        )
});

// Helper functions for common prompt patterns
export const confirmAction = (message: string): TE.TaskEither<CommandError, boolean> => {
    const prompts = createInteractivePrompts();
    return pipe(
        prompts.showMenu<'yes' | 'no'>(
            message,
            [
                { name: 'Yes', value: 'yes' },
                { name: 'No', value: 'no' }
            ],
            { includeGoBack: false }
        ),
        TE.map((result) => result === 'yes')
    );
};

export const pressKeyToContinue = (): TE.TaskEither<CommandError, void> => {
    const prompts = createInteractivePrompts();
    return pipe(
        prompts.getInput('Press Enter to continue...'),
        TE.map(() => void 0)
    );
};
