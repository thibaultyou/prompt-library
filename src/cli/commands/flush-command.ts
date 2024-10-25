import chalk from 'chalk';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import { CommandError, CommandResult, createCommand, createCommandError, taskEitherFromPromise } from './base-command';
import { confirmAction, pressKeyToContinue } from './interactive';
import { flushData } from '../utils/database';
import { flushDirectories } from '../utils/file-system';

// Types
interface FlushCommandResult extends CommandResult {
    readonly action: 'flush' | 'cancel';
}

// Pure functions
const createFlushResult = (action: 'flush' | 'cancel'): FlushCommandResult => ({
    completed: true,
    action
});

// Effects
const logFlushSuccess = (): TE.TaskEither<CommandError, void> =>
    taskEitherFromPromise(
        async () => {
            console.log(chalk.green('Data flushed successfully. The CLI will now exit.'));
        },
        (error) => createCommandError('LOGGING_ERROR', 'Failed to log success message', error)
    );

const logFlushCancelled = (): TE.TaskEither<CommandError, void> =>
    taskEitherFromPromise(
        async () => {
            console.log(chalk.yellow('Flush operation cancelled.'));
        },
        (error) => createCommandError('LOGGING_ERROR', 'Failed to log cancellation message', error)
    );

const exitProcess = (): TE.TaskEither<CommandError, void> =>
    taskEitherFromPromise(
        async () => {
            process.exit(0);
        },
        (error) => createCommandError('EXIT_ERROR', 'Failed to exit process', error)
    );

// Core functions
const performFlush = (): TE.TaskEither<CommandError, void> =>
    pipe(
        flushDirectories(),
        TE.chain(() =>
            taskEitherFromPromise(
                () => flushData(),
                (error) => createCommandError('FLUSH_ERROR', 'Failed to flush data', error)
            )
        ),
        TE.chain(() => logFlushSuccess()),
        TE.chain(() => exitProcess())
    );

// Main command execution
const executeFlushCommand = (): TE.TaskEither<CommandError, FlushCommandResult> =>
    pipe(
        confirmAction(chalk.yellow('Are you sure you want to flush all data? This action cannot be undone.')),
        TE.chain((confirmed) =>
            confirmed
                ? pipe(
                      performFlush(),
                      TE.map(() => createFlushResult('flush'))
                  )
                : pipe(
                      logFlushCancelled(),
                      TE.map(() => createFlushResult('cancel'))
                  )
        ),
        TE.chain((result) =>
            pipe(
                pressKeyToContinue(),
                TE.map(() => result)
            )
        )
    );

// Export flush command
export const flushCommand = createCommand('flush', 'Flush and reset all data (preserves config)', executeFlushCommand);
