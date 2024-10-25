#!/usr/bin/env node
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';

import { getConfigValue, setConfig } from '../shared/config';
import { CommandError } from './commands/base-command';
import { configCommand } from './commands/config-command';
import { envCommand } from './commands/env-command';
import { flushCommand } from './commands/flush-command';
import { fragmentsCommand } from './commands/fragments-command';
import { showMainMenu } from './commands/menu-command';
import { promptsCommand } from './commands/prompts-command';
import { settingsCommand } from './commands/settings-command';
import { syncCommand } from './commands/sync-command';
import { initDatabase } from './utils/database';

// Set environment
process.env.CLI_ENV = 'cli';
dotenv.config();

// Types
interface CliError extends CommandError {
    readonly type: 'CLI_ERROR';
}

interface CliConfig {
    readonly program: Command;
    readonly apiKey: string;
}

// Pure functions for CLI setup
const createCliError = (code: string, message: string): CliError => ({
    type: 'CLI_ERROR',
    code,
    message
});
const validateApiKey = (apiKey: string): E.Either<CliError, string> =>
    apiKey.trim() === '' ? E.left(createCliError('INVALID_API_KEY', 'API key cannot be empty')) : E.right(apiKey);
const getStoredApiKey = (): O.Option<string> =>
    pipe(
        O.fromNullable(getConfigValue('ANTHROPIC_API_KEY')),
        O.filter((key) => key.trim() !== '')
    );
// Effects
const promptForApiKey = (): TE.TaskEither<CliError, string> =>
    pipe(
        TE.tryCatch(
            () => input({ message: 'Please enter your Anthropic API key:' }),
            (error) => createCliError('API_KEY_INPUT_ERROR', `Failed to get API key input: ${error}`)
        ),
        TE.chain((key) => pipe(validateApiKey(key), TE.fromEither))
    );
const setApiKey = (apiKey: string): TE.TaskEither<CliError, string> =>
    pipe(
        TE.tryCatch(
            () => {
                setConfig('ANTHROPIC_API_KEY', apiKey);
                return Promise.resolve(apiKey);
            },
            (error) => createCliError('API_KEY_SAVE_ERROR', `Failed to save API key: ${error}`)
        )
    );
const ensureApiKey = (): TE.TaskEither<CliError, string> =>
    pipe(
        getStoredApiKey(),
        O.fold(
            () => pipe(promptForApiKey(), TE.chain(setApiKey)),
            (apiKey) => TE.right(apiKey)
        )
    );
// Program setup
const createProgram = (): Command => {
    const program = new Command();
    return program
        .name('prompt-library-cli')
        .description('CLI tool for managing and executing AI prompts')
        .version('1.0.0');
};
const registerCommands = (program: Command): Command => {
    const commands = [
        configCommand,
        envCommand,
        flushCommand,
        fragmentsCommand,
        promptsCommand,
        settingsCommand,
        syncCommand
    ];
    commands.forEach((cmd) => program.addCommand(cmd));
    return program;
};
const initializeCli = (): TE.TaskEither<CliError, CliConfig> =>
    pipe(
        TE.tryCatch(
            () => initDatabase(),
            (error) => createCliError('DATABASE_INIT_ERROR', `Failed to initialize database: ${error}`)
        ),
        TE.chain(() => ensureApiKey()),
        TE.map((apiKey) => ({
            program: pipe(createProgram(), registerCommands),
            apiKey
        }))
    );
// Main program flow
const main = async (): Promise<void> => {
    await pipe(
        initializeCli(),
        TE.chain((config) =>
            TE.tryCatch(
                async () => {
                    if (process.argv.length > 2) {
                        await config.program.parseAsync(process.argv);
                    } else {
                        await showMainMenu(config.program);
                    }
                },
                (error) => createCliError('EXECUTION_ERROR', `Failed to execute CLI: ${error}`)
            )
        ),
        TE.fold(
            (error) => {
                console.error(chalk.red(`Error: ${error.message}`));
                return T.of(undefined);
            },
            () => T.of(undefined)
        )
    )();
};

if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}
