// settings-command.ts
import { Command } from 'commander';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import { CommandError, CommandResult, createCommand, createCommandError } from './base-command';
import { configCommand } from './config-command';
import { createInteractivePrompts, MenuChoice } from './interactive';
import { syncCommand } from './sync-command';
import { flushCommand } from './flush-command';
import chalk from 'chalk';

// Types
type SettingsAction = 'config' | 'sync' | 'flush' | 'back';

interface SettingsCommandResult extends CommandResult {
    readonly action: SettingsAction;
}

// Create interactive prompts instance
const prompts = createInteractivePrompts();
// Pure functions
const createSettingsChoices = (): ReadonlyArray<MenuChoice<SettingsAction>> => [
    { name: 'Configure CLI', value: 'config' },
    { name: 'Sync with remote repository', value: 'sync' },
    { name: chalk.red('Flush and reset data'), value: 'flush' }
];
// Command map with proper typing
const commandMap: Record<Exclude<SettingsAction, 'back'>, Command> = {
    config: configCommand,
    sync: syncCommand,
    flush: flushCommand
};
// Effects
const executeSettingsAction = (action: SettingsAction): TE.TaskEither<CommandError, SettingsCommandResult> => {
    if (action === 'back') {
        return TE.right({ action, completed: true });
    }

    const command = commandMap[action];

    if (!command) {
        return TE.left(createCommandError('INVALID_ACTION', `Invalid action: ${action}`));
    }
    return pipe(
        TE.tryCatch(
            async () => {
                await command.parseAsync([], { from: 'user' });
                return { action, completed: false };
            },
            (error) =>
                createCommandError(
                    'COMMAND_EXECUTION_ERROR',
                    `Failed to execute ${action} command: ${error instanceof Error ? error.message : String(error)}`
                )
        )
    );
};
const showSettingsMenu = (): TE.TaskEither<CommandError, SettingsAction> =>
    prompts.showMenu<SettingsAction>('Settings Menu:', createSettingsChoices());
const handleSettingsAction = (action: SettingsAction): TE.TaskEither<CommandError, SettingsCommandResult> =>
    action === 'back'
        ? TE.right({ action, completed: true })
        : pipe(
              executeSettingsAction(action),
              TE.map(() => ({ action, completed: false }))
          );
// Main command execution
const executeSettingsCommand = (): TE.TaskEither<CommandError, SettingsCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, SettingsCommandResult> =>
        pipe(
            showSettingsMenu(),
            TE.chain(handleSettingsAction),
            TE.chain((result) => {
                if (result.completed) {
                    return TE.right(result);
                }
                return loop();
            })
        );
    return loop();
};

// Export settings command
export const settingsCommand = createCommand('settings', 'Manage CLI configuration', executeSettingsCommand);
