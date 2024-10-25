import chalk from 'chalk';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import {
    CommandError,
    CommandResult,
    createCommand,
    createCommandError,
    createCommandLoop,
    taskEitherFromPromise
} from './base-command';
import { createInteractivePrompts, MenuChoice } from './interactive';
import { Config, getConfig, setConfig } from '../../shared/config';

// Type definitions
type ConfigAction = 'view' | 'set' | 'back';

interface ConfigCommandResult extends CommandResult {
    // readonly action: ConfigAction;
    readonly key?: keyof Config;
    readonly value?: string;
}

// Create interactive prompts instance
const prompts = createInteractivePrompts();
// Pure functions for config operations
const viewConfig = (): TE.TaskEither<CommandError, ConfigCommandResult> =>
    pipe(
        taskEitherFromPromise(
            () => Promise.resolve(getConfig()),
            (error) => createCommandError('CONFIG_ERROR', 'Failed to read config', error)
        ),
        TE.map((config) => {
            displayConfig(config);
            return {
                completed: false,
                action: 'view' as const
            };
        })
    );
const setConfigValue = (key: keyof Config, value: string): TE.TaskEither<CommandError, ConfigCommandResult> =>
    pipe(
        taskEitherFromPromise(
            () => {
                setConfig(key, value);
                return Promise.resolve(getConfig());
            },
            (error) => createCommandError('CONFIG_ERROR', 'Failed to set config value', error)
        ),
        TE.map(() => ({
            completed: false,
            action: 'set' as const,
            key,
            value
        }))
    );
// Menu choices generators
const createConfigMenuChoices = (): ReadonlyArray<MenuChoice<ConfigAction>> => [
    { name: 'View current configuration', value: 'view' },
    { name: 'Set a configuration value', value: 'set' }
];
const createConfigKeyChoices = (config: Config): ReadonlyArray<MenuChoice<keyof Config>> =>
    (Object.keys(config) as Array<keyof Config>).map((key) => ({
        name: key,
        value: key
    }));
// Helper functions for displaying config values
const formatConfigValue = (key: keyof Config, value: unknown): string =>
    key === 'ANTHROPIC_API_KEY' ? '********' : String(value);
const displayConfig = (config: Config): void => {
    console.log(chalk.cyan('Current configuration:'));

    if (Object.keys(config).length === 0) {
        console.log(chalk.yellow('The configuration is empty.'));
        return;
    }

    const maxKeyLength = Math.max(...Object.keys(config).map((key) => key.length));

    Object.entries(config).forEach(([key, value]) => {
        const paddingLength = maxKeyLength - key.length;
        const paddedSpaces = paddingLength > 0 ? ' '.repeat(paddingLength) : '';
        console.log(`${key}${paddedSpaces} -> ${chalk.green(formatConfigValue(key as keyof Config, value))}`);
    });
};
// Validation helpers
const validateConfigValue = (key: keyof Config, value: string): E.Either<CommandError, string> =>
    value.trim() === ''
        ? E.left(createCommandError('INVALID_CONFIG_VALUE', 'Configuration value cannot be empty'))
        : E.right(value);
// Interactive workflow functions
const handleSetConfig = (config: Config): TE.TaskEither<CommandError, ConfigCommandResult> =>
    pipe(
        prompts.showMenu<keyof Config | 'back'>('Select the configuration key:', createConfigKeyChoices(config)),
        TE.chain((key) => {
            if (key === 'back') {
                return TE.right({ completed: true });
            }
            return pipe(
                prompts.getInput(`Enter the value for ${chalk.cyan(key)}:`),
                TE.chain((value) =>
                    pipe(
                        validateConfigValue(key, value),
                        TE.fromEither,
                        TE.chain(() => setConfigValue(key, value))
                    )
                )
            );
        })
    );
// Main command execution
const executeConfigCommand = (): TE.TaskEither<CommandError, ConfigCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, ConfigCommandResult> =>
        pipe(
            prompts.showMenu<ConfigAction>('Select an action:', createConfigMenuChoices()),
            TE.chain((action) => {
                switch (action) {
                    case 'view':
                        return viewConfig();
                    case 'set':
                        return handleSetConfig(getConfig());
                    case 'back':
                        return TE.right({ completed: true, action });
                    default:
                        return TE.left(createCommandError('INVALID_ACTION', `Invalid action: ${action}`));
                }
            })
        );
    return createCommandLoop(loop);
};

// Command export
export const configCommand = createCommand('config', 'Manage CLI configuration', executeConfigCommand);
