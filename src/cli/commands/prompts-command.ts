import chalk from 'chalk';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import {
    CommandError,
    CommandResult,
    createCommand,
    createCommandError,
    createCommandLoop,
    fromApiFunction,
    fromApiResult,
    taskEitherFromPromise
} from './base-command';
import { createInteractivePrompts, MenuChoice } from './interactive';
import { CategoryItem, EnvVariable, PromptFragment, PromptMetadata, PromptVariable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../constants';
import { ConversationManager } from '../utils/conversation-manager';
import { fetchCategories, getPromptDetails, updatePromptVariable } from '../utils/database';
import { readEnvVariables } from '../utils/env-vars';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { viewPromptDetails } from '../utils/prompts';

type PromptAction = 'all' | 'category' | 'id' | 'back';
type VariableAction = 'enter' | 'fragment' | 'env' | 'unset' | 'back';
type PromptExecuteAction = 'continue' | 'back';

interface PromptCommandResult extends CommandResult {
    readonly action?: PromptAction;
}

const prompts = createInteractivePrompts();
const createPromptMenuChoices = (): ReadonlyArray<MenuChoice<PromptAction>> => [
    { name: 'View prompts by category', value: 'category' },
    { name: 'View all prompts', value: 'all' },
    { name: 'View all prompts sorted by ID', value: 'id' }
];
const createVariableActionChoices = (hasEnvVar: boolean): ReadonlyArray<MenuChoice<VariableAction>> => [
    { name: 'Enter value', value: 'enter' },
    { name: 'Use fragment', value: 'fragment' },
    {
        name: hasEnvVar ? chalk.green(chalk.bold('Use environment variable')) : 'Use environment variable',
        value: 'env'
    },
    { name: 'Unset', value: 'unset' }
];
const getVariableNameColor = (variable: PromptVariable): ((text: string) => string) => {
    if (variable.value) {
        if (variable.value.startsWith(FRAGMENT_PREFIX)) return chalk.blue;

        if (variable.value.startsWith(ENV_PREFIX)) return chalk.magenta;
        return chalk.green;
    }
    return variable.optional_for_user ? chalk.yellow : chalk.red;
};
const getVariableHint = (variable: PromptVariable, envVars: ReadonlyArray<EnvVariable>): string =>
    !variable.value && envVars.some((env) => env.name === variable.name) ? chalk.magenta(' (env available)') : '';
const formatVariableName = (variable: PromptVariable, envVars: ReadonlyArray<EnvVariable>): string => {
    const snakeCaseName = formatSnakeCase(variable.name);
    const nameColor = getVariableNameColor(variable);
    const hint = getVariableHint(variable, envVars);
    return `${chalk.reset('Assign')} ${nameColor(snakeCaseName)}${chalk.reset(variable.optional_for_user ? '' : '*')}${hint}`;
};
const getAllPrompts = (categories: Record<string, CategoryItem[]>): Array<CategoryItem & { category: string }> =>
    Object.entries(categories)
        .flatMap(([category, prompts]) =>
            prompts.map((prompt) => ({
                ...prompt,
                category
            }))
        )
        .sort((a, b) => a.title.localeCompare(b.title));
const assignValueToVariable = (promptId: string, variable: PromptVariable): TE.TaskEither<CommandError, void> =>
    pipe(
        prompts.getMultilineInput(`Value for ${formatSnakeCase(variable.name)}:`, variable.value || ''),
        TE.chain((value) =>
            pipe(
                fromApiResult(updatePromptVariable(promptId, variable.name, value)),
                TE.map(() => {
                    console.log(chalk.green(`Value set for ${formatSnakeCase(variable.name)}`));
                })
            )
        )
    );
const assignFragmentToVariable = (promptId: string, variable: PromptVariable): TE.TaskEither<CommandError, void> =>
    pipe(
        fromApiResult(listFragments()),
        TE.chain((fragments) =>
            prompts.showMenu<PromptFragment | 'back'>(
                'Select a fragment:',
                fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} / ${chalk.blue(f.name)}`,
                    value: f
                }))
            )
        ),
        TE.chain((fragment) => {
            if (fragment === 'back') {
                console.log(chalk.yellow('Fragment assignment cancelled.'));
                return TE.right(undefined);
            }

            const fragmentRef = `${FRAGMENT_PREFIX}${fragment.category}/${fragment.name}`;
            return pipe(
                fromApiResult(updatePromptVariable(promptId, variable.name, fragmentRef)),
                TE.chain(() =>
                    pipe(
                        fromApiResult(viewFragmentContent(fragment.category, fragment.name)),
                        TE.map((content) => {
                            console.log(chalk.green(`Fragment assigned to ${formatSnakeCase(variable.name)}`));
                            console.log(chalk.cyan('Fragment content preview:'));
                            console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
                        })
                    )
                )
            );
        })
    );
const assignEnvVarToVariable = (promptId: string, variable: PromptVariable): TE.TaskEither<CommandError, void> =>
    pipe(
        fromApiResult(readEnvVariables()),
        TE.chain((envVars) => {
            const matchingEnvVars = envVars.filter(
                (ev) =>
                    ev.name.toLowerCase().includes(variable.name.toLowerCase()) ||
                    variable.name.toLowerCase().includes(ev.name.toLowerCase())
            );
            return prompts.showMenu<EnvVariable | 'back'>('Select an Environment Variable:', [
                ...matchingEnvVars.map((v) => ({
                    name: chalk.green(chalk.bold(`${formatSnakeCase(v.name)} (${v.scope}) - Suggested Match`)),
                    value: v
                })),
                ...envVars
                    .filter((v) => !matchingEnvVars.includes(v))
                    .map((v) => ({
                        name: `${formatSnakeCase(v.name)} (${v.scope})`,
                        value: v
                    }))
            ]);
        }),
        TE.chain((selectedEnvVar) => {
            if (selectedEnvVar === 'back') {
                console.log(chalk.yellow('Environment variable assignment cancelled.'));
                return TE.right(undefined);
            }

            const envVarRef = `${ENV_PREFIX}${selectedEnvVar.name}`;
            return pipe(
                fromApiResult(updatePromptVariable(promptId, variable.name, envVarRef)),
                TE.map(() => {
                    console.log(chalk.green(`Environment variable assigned to ${formatSnakeCase(variable.name)}`));
                    console.log(chalk.cyan(`Current value: ${selectedEnvVar.value}`));
                })
            );
        })
    );
const unsetVariable = (promptId: string, variable: PromptVariable): TE.TaskEither<CommandError, void> =>
    pipe(
        fromApiResult(updatePromptVariable(promptId, variable.name, '')),
        TE.map(() => {
            console.log(chalk.green(`Value unset for ${formatSnakeCase(variable.name)}`));
        })
    );
const unsetAllVariables = (promptId: string): TE.TaskEither<CommandError, void> =>
    pipe(
        fromApiResult(getPromptDetails(promptId)),
        TE.chain((details) =>
            pipe(
                details.variables,
                TE.traverseArray((variable) =>
                    pipe(
                        fromApiResult(updatePromptVariable(promptId, variable.name, '')),
                        TE.map(() => {
                            console.log(chalk.green(`Unset ${formatSnakeCase(variable.name)}`));
                        })
                    )
                )
            )
        ),
        TE.map(() => {
            console.log(chalk.green('All variables have been unset.'));
        })
    );
const handleVariableAssignment = (
    promptId: string,
    variable: PromptVariable,
    action: VariableAction
): TE.TaskEither<CommandError, boolean> => {
    switch (action) {
        case 'enter':
            return pipe(
                assignValueToVariable(promptId, variable),
                TE.map(() => false) // Continue in the same prompt
            );
        case 'fragment':
            return pipe(
                assignFragmentToVariable(promptId, variable),
                TE.map(() => false)
            );
        case 'env':
            return pipe(
                assignEnvVarToVariable(promptId, variable),
                TE.map(() => false)
            );
        case 'unset':
            return pipe(
                unsetVariable(promptId, variable),
                TE.map(() => false)
            );
        case 'back':
            return TE.right(false);
        default:
            return TE.left(createCommandError('INVALID_ACTION', `Invalid action: ${action}`));
    }
};
const executePrompt = (promptId: string, details: PromptMetadata): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.Do,
        TE.bind('conversationManager', () => TE.right(new ConversationManager(promptId))),
        TE.bind('userInputs', () =>
            pipe(
                details.variables,
                TE.traverseArray((variable) =>
                    variable.value
                        ? TE.right([variable.name, variable.value] as const)
                        : !variable.optional_for_user
                          ? pipe(
                                prompts.getMultilineInput(`Enter value for ${formatSnakeCase(variable.name)}:`),
                                TE.map((value) => [variable.name, value] as const)
                            )
                          : TE.right([variable.name, ' '] as const)
                )
            )
        ),
        TE.chain(({ conversationManager, userInputs }) =>
            pipe(
                fromApiResult(conversationManager.initializeConversation(Object.fromEntries(userInputs))),
                TE.chain(() => continueConversation(conversationManager))
            )
        )
    );
const continueConversation = (conversationManager: ConversationManager): TE.TaskEither<CommandError, void> => {
    const loop = (): TE.TaskEither<CommandError, void> =>
        pipe(
            prompts.showMenu<PromptExecuteAction>('What would you like to do next?', [
                { name: chalk.green(chalk.bold('Continue conversation')), value: 'continue' }
            ]),
            TE.chain((action) => {
                if (action === 'back') return TE.right(undefined);
                return pipe(
                    prompts.getMultilineInput(''),
                    TE.chain((input) =>
                        pipe(
                            fromApiResult(conversationManager.continueConversation(input)),
                            TE.chain(() => loop())
                        )
                    )
                );
            })
        );
    return loop();
};
const managePromptVariables = (promptId: string): TE.TaskEither<CommandError, boolean> => {
    const loop = (): TE.TaskEither<CommandError, boolean> =>
        pipe(
            TE.Do,
            TE.bind('details', () => fromApiResult(getPromptDetails(promptId))),
            TE.bind('envVars', () => fromApiResult(readEnvVariables())),
            TE.chain(({ details, envVars }) =>
                pipe(
                    taskEitherFromPromise(
                        () => viewPromptDetails(details),
                        (error) => createCommandError('VIEW_ERROR', 'Failed to view prompt details', error)
                    ),
                    TE.chain(() =>
                        prompts.showMenu<PromptVariable | 'execute' | 'unset_all' | 'back'>(
                            `Select an action for prompt "${chalk.cyan(details.title)}":`,
                            [
                                ...(details.variables.every((v) => v.optional_for_user || v.value)
                                    ? [{ name: chalk.green(chalk.bold('Execute prompt')), value: 'execute' as const }]
                                    : []),
                                ...details.variables.map((v) => ({
                                    name: formatVariableName(v, envVars),
                                    value: v
                                })),
                                { name: chalk.red('Unset all variables'), value: 'unset_all' as const }
                            ]
                        )
                    ),
                    TE.chain((action): TE.TaskEither<CommandError, boolean> => {
                        if (action === 'back') return TE.right(true);

                        if (action === 'execute') {
                            return pipe(
                                executePrompt(promptId, details),
                                TE.map(() => false)
                            );
                        }

                        if (action === 'unset_all') {
                            return pipe(
                                unsetAllVariables(promptId),
                                TE.map(() => false)
                            );
                        }
                        return pipe(
                            prompts.showMenu<VariableAction>(
                                `Choose action for ${formatSnakeCase(action.name)}:`,
                                createVariableActionChoices(envVars.some((env) => env.name === action.name))
                            ),
                            TE.chain((variableAction) => handleVariableAssignment(promptId, action, variableAction))
                        );
                    }),
                    TE.chain((shouldGoBack) => (shouldGoBack ? TE.right(true) : loop()))
                )
            )
        );
    return loop();
};
const listPromptsByCategory = (categories: Record<string, CategoryItem[]>): TE.TaskEither<CommandError, boolean> => {
    const loop = (): TE.TaskEither<CommandError, boolean> =>
        pipe(
            prompts.showMenu<string | 'back'>(
                'Select a category:',
                Object.keys(categories)
                    .sort()
                    .map((category) => ({
                        name: formatTitleCase(category),
                        value: category
                    }))
            ),
            TE.chain((category) => {
                if (category === 'back') return TE.right(true);

                const promptsWithCategory = categories[category].map((prompt) => ({
                    ...prompt,
                    category
                }));
                return pipe(
                    selectAndManagePrompt(promptsWithCategory),
                    TE.chain((shouldGoBack) => (shouldGoBack ? loop() : TE.right(false)))
                );
            })
        );
    return loop();
};
const selectAndManagePrompt = (
    promptsList: Array<CategoryItem & { category: string }>
): TE.TaskEither<CommandError, boolean> => {
    const loop = (): TE.TaskEither<CommandError, boolean> =>
        pipe(
            prompts.showMenu<CategoryItem | 'back'>(
                'Select a prompt:',
                promptsList.map((p) => ({
                    name: `${formatTitleCase(p.category)} / ${chalk.green(p.title)} (ID: ${p.id})`,
                    value: p
                }))
            ),
            TE.chain((selectedPrompt) => {
                if (selectedPrompt === 'back') return TE.right(true);
                return pipe(
                    TE.Do,
                    TE.bind('id', () => TE.right(selectedPrompt.id)),
                    TE.chain(({ id }) => managePromptVariables(id)),
                    TE.chain((shouldGoBack) => (shouldGoBack ? loop() : TE.right(false)))
                );
            })
        );
    return loop();
};
const executePromptsCommand = (): TE.TaskEither<CommandError, PromptCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, PromptCommandResult> =>
        pipe(
            fromApiFunction(() => fetchCategories()),
            TE.chain((categories) =>
                pipe(
                    prompts.showMenu<PromptAction>('Select an action:', createPromptMenuChoices()),
                    TE.chain((action): TE.TaskEither<CommandError, PromptCommandResult> => {
                        if (action === 'back') {
                            return TE.right({ completed: true, action });
                        }
                        return pipe(
                            TE.Do,
                            TE.bind('result', () => {
                                switch (action) {
                                    case 'all':
                                        return selectAndManagePrompt(getAllPrompts(categories));
                                    case 'category':
                                        return listPromptsByCategory(categories);
                                    case 'id':
                                        return selectAndManagePrompt(
                                            getAllPrompts(categories).sort((a, b) => Number(a.id) - Number(b.id))
                                        );
                                    default:
                                        return TE.left(
                                            createCommandError('INVALID_ACTION', `Invalid action: ${action}`)
                                        );
                                }
                            }),
                            TE.map(() => ({ completed: false, action }))
                        );
                    })
                )
            )
        );
    return createCommandLoop(loop);
};

export const promptsCommand = createCommand('prompts', 'List and manage prompts', executePromptsCommand);
