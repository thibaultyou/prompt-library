import { Command } from 'commander';
import * as A from 'fp-ts/lib/Array';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';

import { ApiResult } from '../../shared/types';

// Core types
export type CommandContext = {
    readonly args: ReadonlyArray<string>;
    readonly options: Readonly<Record<string, unknown>>;
};

export type CommandError = {
    readonly code: string;
    readonly message: string;
    readonly context?: unknown;
};

export interface CommandResult {
    readonly completed: boolean;
    readonly action?: string;
}

export interface BaseCommand<A> {
    readonly name: string;
    readonly description: string;
    readonly execute: (ctx: CommandContext) => Promise<TE.TaskEither<CommandError, A>>;
}

// export type CommandResult<A> = E.Either<CommandError, A>;

export type CommandTask<A> = TE.TaskEither<CommandError, A>;

// Command creation helper
export const createCommand = <A extends CommandResult>(
    name: string,
    description: string,
    execute: (ctx: CommandContext) => TE.TaskEither<CommandError, A>
): Command => {
    const command = new Command(name);
    command.description(description);

    command.action(async (...args) => {
        const ctx: CommandContext = {
            args: args.slice(0, -1),
            options: args[args.length - 1] || {}
        };
        await pipe(
            execute(ctx),
            TE.fold(
                (error: CommandError) =>
                    T.of(
                        (() => {
                            throw new Error(`Failed to execute ${name} command: ${error.message}`);
                        })()
                    ),
                (value: A) => T.of(value)
            )
        )();
    });
    return command;
};

export const createCommandLoop = <A extends CommandResult>(
    loopFn: () => TE.TaskEither<CommandError, A>
): TE.TaskEither<CommandError, A> => {
    const runLoop = (previousResult?: A): TE.TaskEither<CommandError, A> => {
        if (previousResult?.completed) {
            return TE.right(previousResult);
        }
        return pipe(loopFn(), TE.chain(runLoop));
    };
    return runLoop();
};

// Helper for handling command results
export const handleCommandResult = <A>(
    result: A,
    options?: {
        onSuccess?: (value: A) => void;
        silent?: boolean;
    }
): void => {
    if (!options?.silent) {
        if (options?.onSuccess) {
            options.onSuccess(result);
        }
    }
};

// Type guard for command errors
export const isCommandError = (error: unknown): error is CommandError =>
    typeof error === 'object' && error !== null && 'code' in error && 'message' in error;

// Helper for creating command errors
export const createCommandError = (code: string, message: string, context?: unknown): CommandError => ({
    code,
    message,
    context
});

// Task composition helpers with fixed types
export const withErrorHandling = <A>(task: T.Task<A>, errorMapper: (error: unknown) => CommandError): CommandTask<A> =>
    pipe(
        task,
        TE.fromTask,
        TE.mapLeft((error) => errorMapper(error))
    );

// Validation chain helper with fixed types
export const validate = <A>(
    value: A,
    validators: Array<(value: A) => E.Either<CommandError, A>>
): E.Either<CommandError, A> =>
    validators.reduce(
        (result, validator) => pipe(result, E.chain(validator)),
        E.right(value) as E.Either<CommandError, A>
    );

// Helper for creating TaskEither from Promise
export const taskEitherFromPromise = <A>(
    promise: () => Promise<A>,
    errorMapper: (error: unknown) => CommandError
): TE.TaskEither<CommandError, A> =>
    TE.tryCatch(async () => {
        const result = await promise();
        return result as A; // Allow undefined/void returns
    }, errorMapper);

// Helper for converting ApiResult to TaskEither
export const fromApiResult = <A>(promise: Promise<ApiResult<A>>): TE.TaskEither<CommandError, A> =>
    TE.tryCatch(
        async () => {
            const result = await promise;

            if (!result.success) {
                throw new Error(result.error || 'Operation failed');
            }
            return result.data as A; // Allow undefined data
        },
        (error) => createCommandError('API_ERROR', String(error))
    );

// Helper for converting ApiResult-returning function to TaskEither
export const fromApiFunction = <A>(fn: () => Promise<ApiResult<A>>): TE.TaskEither<CommandError, A> =>
    TE.tryCatch(
        async () => {
            const result = await fn();

            if (!result.success) {
                throw new Error(result.error || 'Operation failed');
            }
            return result.data as A; // Allow undefined data
        },
        (error) => createCommandError('API_ERROR', String(error))
    );

// Helper for handling nullable values
export const fromNullable = <A>(
    value: A | null | undefined,
    errorMessage: string
): TE.TaskEither<CommandError, NonNullable<A>> =>
    pipe(
        O.fromNullable(value),
        TE.fromOption(() => createCommandError('NULL_ERROR', errorMessage))
    );

// Helper for handling optional values with custom error
export const requireValue = <A>(
    value: A | undefined,
    errorCode: string,
    errorMessage: string
): TE.TaskEither<CommandError, NonNullable<A>> =>
    pipe(
        O.fromNullable(value),
        TE.fromOption(() => createCommandError(errorCode, errorMessage))
    );

// Helper for handling arrays of TaskEither
export const sequenceArray = <A>(tasks: Array<TE.TaskEither<CommandError, A>>): TE.TaskEither<CommandError, Array<A>> =>
    pipe(tasks, A.sequence(TE.ApplicativeSeq));

// Helper for mapping arrays with TaskEither
export const traverseArray = <A, B>(
    arr: Array<A>,
    f: (a: A) => TE.TaskEither<CommandError, B>
): TE.TaskEither<CommandError, Array<B>> => pipe(arr, A.traverse(TE.ApplicativeSeq)(f));

// Helper for conditional execution
export const whenTE = <A>(
    condition: boolean,
    task: TE.TaskEither<CommandError, A>
): TE.TaskEither<CommandError, O.Option<A>> =>
    condition
        ? pipe(
              task,
              TE.map((a) => O.some(a))
          )
        : TE.right(O.none);

// Helper for handling errors with recovery
export const withErrorRecovery = <A>(
    task: TE.TaskEither<CommandError, A>,
    recovery: (error: CommandError) => TE.TaskEither<CommandError, A>
): TE.TaskEither<CommandError, A> => pipe(task, TE.orElse(recovery));
