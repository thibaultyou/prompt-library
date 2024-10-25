// menu-command.ts
import chalk from 'chalk';
import { Command } from 'commander';
import { pipe } from 'fp-ts/lib/function';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';

import {
    CommandError,
    taskEitherFromPromise,
    createCommandError,
    CommandContext,
    createCommand,
    CommandResult
} from './base-command';
import { createInteractivePrompts, MenuChoice } from './interactive';
import { getConfig } from '../../shared/config';
import { hasFragments, hasPrompts } from '../utils/file-system';

// Types
type MenuAction = 'sync' | 'prompts' | 'fragments' | 'settings' | 'env' | 'back';

interface MenuCommandResult extends CommandResult {
    readonly action?: MenuAction;
}

// Create interactive prompts instance
const prompts = createInteractivePrompts();
// Pure functions
const createMenuChoices = (
    hasRemoteRepo: boolean,
    hasExistingContent: boolean
): ReadonlyArray<MenuChoice<MenuAction>> => {
    const choices: Array<MenuChoice<MenuAction>> = [];

    if (!hasRemoteRepo || !hasExistingContent) {
        choices.push({
            name: chalk.green(chalk.bold('Sync with remote repository')),
            value: 'sync'
        });
    }

    choices.push(
        { name: 'Browse and run prompts', value: 'prompts' },
        { name: 'Manage prompt fragments', value: 'fragments' },
        { name: 'Manage environment variables', value: 'env' },
        { name: 'Settings', value: 'settings' }
    );
    return choices;
};
// Effects
const checkContentStatus = (): TE.TaskEither<CommandError, boolean> =>
    pipe(
        taskEitherFromPromise(
            () => Promise.all([hasPrompts(), hasFragments()]),
            (error) => createCommandError('CONTENT_CHECK_ERROR', 'Failed to check content status', error)
        ),
        TE.map(([promptsExist, fragmentsExist]) => promptsExist || fragmentsExist)
    );
const executeMenuAction = (program: Command, action: MenuAction): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.tryCatch(
            async () => {
                const command = program.commands.find((cmd) => cmd.name() === action);

                if (!command) {
                    throw new Error(`Command '${action}' not found`);
                }

                await command.parseAsync([], { from: 'user' });
            },
            (error) =>
                createCommandError(
                    'COMMAND_EXECUTION_ERROR',
                    `Failed to execute '${action}' command: ${error instanceof Error ? error.message : String(error)}`,
                    error
                )
        )
    );
const showMenuPrompt = (
    hasRemoteRepo: boolean,
    hasExistingContent: boolean
): TE.TaskEither<CommandError, MenuAction> => {
    console.clear();
    console.log(chalk.bold(chalk.cyan('Welcome to the Prompt Library !')));
    return prompts.showMenu<MenuAction>(`Select an action:`, createMenuChoices(hasRemoteRepo, hasExistingContent), {
        goBackLabel: 'Exit'
    });
};
// Main menu loop
const handleExit = (): TE.TaskEither<CommandError, MenuCommandResult> =>
    TE.tryCatch(
        async () => {
            console.log(chalk.yellow('Goodbye!'));
            return {
                action: 'back' as const,
                completed: true
            };
        },
        (error) => createCommandError('MENU_ERROR', 'Failed to handle exit', error)
    );
const handleMenuAction = (
    program: Command,
    action: Exclude<MenuAction, 'back'>
): TE.TaskEither<CommandError, MenuCommandResult> =>
    pipe(
        executeMenuAction(program, action),
        TE.map(() => ({
            action,
            completed: false
        }))
    );
const runMenuLoop = (program: Command): TE.TaskEither<CommandError, MenuCommandResult> => {
    const config = getConfig();
    const hasRemoteRepo = Boolean(config.REMOTE_REPOSITORY);
    return pipe(
        checkContentStatus(),
        TE.chain((hasExistingContent) => showMenuPrompt(hasRemoteRepo, hasExistingContent)),
        TE.chain((action) => (action === 'back' ? handleExit() : handleMenuAction(program, action)))
    );
};
// Command execution
const executeMenuCommand = (
    ctx: CommandContext & { program: Command }
): TE.TaskEither<CommandError, MenuCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, MenuCommandResult> =>
        pipe(
            runMenuLoop(ctx.program),
            TE.chain((result) => {
                if (result.completed) {
                    return TE.right(result);
                }
                return loop();
            })
        );
    return loop();
};

// Export menu command
export const menuCommand = (program: Command): Command =>
    createCommand('menu', 'Main menu for the CLI', (ctx: CommandContext) => executeMenuCommand({ ...ctx, program }));

// Export show main menu function
export const showMainMenu = (program: Command): Promise<void> =>
    pipe(
        executeMenuCommand({ args: [], options: {}, program }),
        TE.fold(
            (error) => {
                console.error(chalk.red('Error:'), error.message, error.context || '');
                return T.of(undefined);
            },
            () => T.of(undefined)
        )
    )();
