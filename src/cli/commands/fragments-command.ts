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
    fromApiResult
} from './base-command';
import { PromptFragment } from '../../shared/types';
import { formatTitleCase } from '../../shared/utils/string-formatter';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { createInteractivePrompts, MenuChoice } from './interactive';

// Types
type FragmentAction = 'all' | 'category' | 'back';

interface FragmentCommandResult extends CommandResult {
    readonly action?: FragmentAction;
}

// Create interactive prompts instance
const prompts = createInteractivePrompts();

// Pure functions
const createFragmentMenuChoices = (): ReadonlyArray<MenuChoice<FragmentAction>> => [
    { name: 'View fragments by category', value: 'category' },
    { name: 'View all fragments', value: 'all' }
];

const sortFragments = (fragments: ReadonlyArray<PromptFragment>): ReadonlyArray<PromptFragment> =>
    [...fragments].sort((a, b) => `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`));

const getUniqueCategories = (fragments: ReadonlyArray<PromptFragment>): ReadonlyArray<string> =>
    [...new Set(fragments.map((f) => f.category))].sort();

const formatFragmentChoice = (fragment: PromptFragment): MenuChoice<PromptFragment> => ({
    name: `${formatTitleCase(fragment.category)} / ${chalk.green(fragment.name)}`,
    value: fragment
});

const formatCategoryChoice = (category: string): MenuChoice<string> => ({
    name: formatTitleCase(category),
    value: category
});

// Effects
const displayFragmentContent = (fragment: PromptFragment, content: string): void => {
    console.log(chalk.red(chalk.bold('\nFragment content:')));
    console.log(chalk.cyan('Category:'), formatTitleCase(fragment.category));
    console.log(chalk.cyan('Name:'), fragment.name);
    console.log(chalk.cyan('Content:'));
    console.log(content);
};

// Core functions
const viewFragmentMenu = (fragments: ReadonlyArray<PromptFragment>): TE.TaskEither<CommandError, void> => {
    const loop = (): TE.TaskEither<CommandError, void> =>
        pipe(
            prompts.showMenu<PromptFragment | 'back'>(
                'Select a fragment to view:',
                fragments.map(formatFragmentChoice)
            ),
            TE.chain((selectedFragment) => {
                if (selectedFragment === 'back') return TE.right(undefined);

                return pipe(
                    fromApiResult(viewFragmentContent(selectedFragment.category, selectedFragment.name)),
                    TE.map((content) => {
                        displayFragmentContent(selectedFragment, content);
                    }),
                    TE.chain(() => loop())
                );
            })
        );
    return loop();
};

const viewFragmentsByCategory = (fragments: ReadonlyArray<PromptFragment>): TE.TaskEither<CommandError, void> => {
    const categories = getUniqueCategories(fragments);

    const loop = (): TE.TaskEither<CommandError, void> =>
        pipe(
            prompts.showMenu<string | 'back'>('Select a category:', categories.map(formatCategoryChoice)),
            TE.chain((category) => {
                if (category === 'back') return TE.right(undefined);

                const categoryFragments = fragments.filter((f) => f.category === category);
                return pipe(
                    viewFragmentMenu(categoryFragments),
                    TE.chain(() => loop())
                );
            })
        );
    return loop();
};

const viewAllFragments = (fragments: ReadonlyArray<PromptFragment>): TE.TaskEither<CommandError, void> =>
    viewFragmentMenu(sortFragments(fragments));

// Main command execution
const executeFragmentsCommand = (): TE.TaskEither<CommandError, FragmentCommandResult> => {
    const loop = (): TE.TaskEither<CommandError, FragmentCommandResult> =>
        pipe(
            prompts.showMenu<FragmentAction>('Select an action:', createFragmentMenuChoices()),
            TE.chain((action): TE.TaskEither<CommandError, FragmentCommandResult> => {
                if (action === 'back') {
                    return TE.right({ completed: true, action });
                }

                return pipe(
                    fromApiFunction(() => listFragments()),
                    TE.chain((fragments) => {
                        switch (action) {
                            case 'all':
                                return pipe(
                                    viewAllFragments(fragments),
                                    TE.map(() => ({ completed: false, action }))
                                );
                            case 'category':
                                return pipe(
                                    viewFragmentsByCategory(fragments),
                                    TE.map(() => ({ completed: false, action }))
                                );
                            default:
                                return TE.left(createCommandError('INVALID_ACTION', `Invalid action: ${action}`));
                        }
                    })
                );
            })
        );
    return createCommandLoop(loop);
};

// Export fragments command
export const fragmentsCommand = createCommand('fragments', 'List and view fragments', executeFragmentsCommand);
