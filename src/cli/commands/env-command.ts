import chalk from 'chalk';
import * as A from 'fp-ts/lib/Array';
import * as Eq from 'fp-ts/lib/Eq';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import * as Ord from 'fp-ts/lib/Ord';
import * as TE from 'fp-ts/lib/TaskEither';

import {
    CommandError,
    createCommand,
    fromApiResult,
    fromApiFunction,
    traverseArray,
    CommandResult,
    createCommandLoop
} from './base-command';
import { EnvVariable, PromptFragment, PromptVariable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { FRAGMENT_PREFIX } from '../constants';
import { createInteractivePrompts, MenuChoice } from './interactive';
import { createEnvVariable, updateEnvVariable, deleteEnvVariable, readEnvVariables } from '../utils/env-vars';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { listPrompts, getPromptFiles } from '../utils/prompts';

// Types
type EnvAction = 'enter' | 'fragment' | 'unset' | 'back';

interface EnvCommandResult extends CommandResult {
    readonly action?: EnvAction;
}

// Instances
const prompts = createInteractivePrompts();
// Display formatting
const getVariableStatus = (envVar: EnvVariable | undefined): string => {
    if (!envVar) return chalk.yellow('Not Set');

    const trimmedValue = envVar.value.trim();
    return trimmedValue.startsWith(FRAGMENT_PREFIX)
        ? chalk.blue(trimmedValue)
        : chalk.green(`Set: ${trimmedValue.substring(0, 20)}${trimmedValue.length > 20 ? '...' : ''}`);
};
const formatVariableChoices = (
    allVariables: ReadonlyArray<PromptVariable>,
    envVars: ReadonlyArray<EnvVariable>
): ReadonlyArray<MenuChoice<PromptVariable>> => {
    const maxNameLength = Math.max(...allVariables.map((v) => formatSnakeCase(v.name).length));
    return allVariables.map((variable) => {
        const formattedName = formatSnakeCase(variable.name);
        const coloredName = formattedName;
        const paddingLength = maxNameLength - formattedName.length;
        const paddedSpaces = paddingLength > 0 ? ' '.repeat(paddingLength) : '';
        const envVar = envVars.find((v) => formatSnakeCase(v.name) === formattedName);
        const status = getVariableStatus(envVar);
        return {
            name: `${coloredName}${paddedSpaces} -> ${status}`,
            value: variable
        };
    });
};
// Variable management
const getAllUniqueVariables = (): TE.TaskEither<CommandError, ReadonlyArray<PromptVariable>> =>
    pipe(
        fromApiFunction(() => listPrompts()),
        TE.chain((prompts) =>
            traverseArray(prompts, (prompt) =>
                prompt.id
                    ? pipe(
                          fromApiFunction(() => getPromptFiles(prompt.id!)),
                          TE.map((details) => details.metadata.variables)
                      )
                    : TE.right([])
            )
        ),
        TE.map((variables) =>
            pipe(
                variables.flat(),
                A.uniq(Eq.fromEquals<PromptVariable>((a, b) => a.name === b.name)),
                A.sort(Ord.fromCompare<PromptVariable>((a, b) => a.name.localeCompare(b.name) as -1 | 0 | 1))
            )
        )
    );
// Variable actions
const enterValueForVariable = (
    variable: PromptVariable,
    envVar: O.Option<EnvVariable>
): TE.TaskEither<CommandError, void> =>
    pipe(
        prompts.getMultilineInput(
            `Value for ${formatSnakeCase(variable.name)}`,
            pipe(
                envVar,
                O.fold(
                    () => '',
                    (ev) => ev.value
                )
            )
        ),
        TE.chain((value) => {
            if (value.trim() === '') {
                console.log(chalk.yellow('Input canceled. Returning to actions menu.'));
                return TE.right(undefined);
            }
            return pipe(
                envVar,
                O.fold(
                    () =>
                        pipe(
                            fromApiResult(
                                createEnvVariable({
                                    name: variable.name,
                                    value,
                                    scope: 'global'
                                })
                            ),
                            TE.map(() => {
                                console.log(
                                    chalk.green(`Created environment variable ${formatSnakeCase(variable.name)}`)
                                );
                            })
                        ),
                    (ev) =>
                        pipe(
                            fromApiResult(updateEnvVariable(ev.id, value)),
                            TE.map(() => {
                                console.log(chalk.green(`Updated value for ${formatSnakeCase(variable.name)}`));
                            })
                        )
                )
            );
        })
    );
const assignFragmentToVariable = (variable: PromptVariable): TE.TaskEither<CommandError, void> =>
    pipe(
        fromApiResult(listFragments()),
        TE.chain((fragments) =>
            prompts.showMenu<PromptFragment | 'back'>('Select a fragment:', [
                ...fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} / ${chalk.blue(f.name)}`,
                    value: f
                }))
            ])
        ),
        TE.chain((fragment) => {
            if (fragment === 'back') {
                console.log(chalk.yellow('Fragment assignment cancelled.'));
                return TE.right(undefined);
            }

            const fragmentRef = `${FRAGMENT_PREFIX}${fragment.category}/${fragment.name}`;
            return pipe(
                fromApiResult(readEnvVariables()),
                TE.chain((envVars) => {
                    const existingEnvVar = envVars.find((v) => v.name === variable.name);
                    return pipe(
                        O.fromNullable(existingEnvVar),
                        O.fold(
                            () =>
                                pipe(
                                    fromApiResult(
                                        createEnvVariable({
                                            name: variable.name,
                                            value: fragmentRef,
                                            scope: 'global'
                                        })
                                    ),
                                    TE.map(() => undefined)
                                ),
                            (ev) =>
                                pipe(
                                    fromApiResult(updateEnvVariable(ev.id, fragmentRef)),
                                    TE.map(() => undefined)
                                )
                        )
                    );
                }),
                TE.chain(() =>
                    pipe(
                        fromApiResult(viewFragmentContent(fragment.category, fragment.name)),
                        TE.map((content) => {
                            console.log(
                                chalk.green(`Fragment reference assigned to ${formatSnakeCase(variable.name)}`)
                            );
                            console.log(chalk.cyan('Fragment content preview:'));
                            console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
                        })
                    )
                )
            );
        })
    );
const unsetVariable = (variable: PromptVariable, envVar: O.Option<EnvVariable>): TE.TaskEither<CommandError, void> =>
    pipe(
        envVar,
        O.fold(
            () => TE.right(console.log(chalk.yellow(`${formatSnakeCase(variable.name)} is already empty`))),
            (ev) =>
                pipe(
                    fromApiResult(deleteEnvVariable(ev.id)),
                    TE.map(() => {
                        console.log(chalk.green(`Unset ${formatSnakeCase(variable.name)}`));
                    })
                )
        )
    );
// Command execution
const executeEnvCommand = (): TE.TaskEither<CommandError, EnvCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, EnvCommandResult> =>
        pipe(
            TE.Do,
            TE.bind('variables', () => getAllUniqueVariables()),
            TE.bind('envVars', () => fromApiFunction(() => readEnvVariables())),
            TE.chain(({ variables, envVars }) =>
                pipe(
                    prompts.showMenu<PromptVariable | 'back'>(
                        'Select a variable to manage:',
                        formatVariableChoices(variables, envVars)
                    ),
                    TE.chain((selectedVariable): TE.TaskEither<CommandError, EnvCommandResult> => {
                        if (selectedVariable === 'back') {
                            console.log(chalk.yellow('Returning to main menu.'));
                            return TE.right({ completed: true });
                        }
                        return pipe(
                            prompts.showMenu<EnvAction>(
                                `Choose action for ${formatSnakeCase(selectedVariable.name)}:`,
                                [
                                    { name: 'Enter value', value: 'enter' },
                                    { name: 'Use fragment', value: 'fragment' },
                                    { name: 'Unset', value: 'unset' }
                                ]
                            ),
                            TE.chain((action) => {
                                const envVar = O.fromNullable(envVars.find((v) => v.name === selectedVariable.name));
                                switch (action) {
                                    case 'enter':
                                        return pipe(
                                            enterValueForVariable(selectedVariable, envVar),
                                            TE.map(() => ({ completed: false }))
                                        );
                                    case 'fragment':
                                        return pipe(
                                            assignFragmentToVariable(selectedVariable),
                                            TE.map(() => ({ completed: false }))
                                        );
                                    case 'unset':
                                        return pipe(
                                            unsetVariable(selectedVariable, envVar),
                                            TE.map(() => ({ completed: false }))
                                        );
                                    case 'back':
                                        console.log(chalk.yellow('Returning to variables menu.'));
                                        return TE.right({ completed: false });
                                    default:
                                        console.warn(chalk.red(`Unknown action: ${action}`));
                                        return TE.right({ completed: false });
                                }
                            })
                        );
                    })
                )
            )
        );
    return createCommandLoop(loop);
};

export const envCommand = createCommand('env', 'Manage environment variables', executeEnvCommand);
