import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { createCommand, editCommand, deleteCommand } from './fragment-commands';
import { PromptFragment } from '../../shared/types';
import { formatTitleCase } from '../../shared/utils/string-formatter';
import { formatFragmentsTable, listFragments, viewFragmentContent } from '../utils/fragments';
import { createCategoryHeader, createSectionHeader, formatMenuItem, printSectionHeader } from '../utils/ui-components';

// Add type definitions for the commands with their additional methods
type EditCommandWithMethods = typeof editCommand & {
    editFragment: (category: string, name: string, content: string) => Promise<boolean>;
};

type DeleteCommandWithMethods = typeof deleteCommand & {
    deleteFragment: (category: string, name: string) => Promise<boolean>;
};

// Cast the commands to include their additional methods
const editCommandWithMethods = editCommand as EditCommandWithMethods;
const deleteCommandWithMethods = deleteCommand as DeleteCommandWithMethods;

interface ExpandedPromptFragment extends PromptFragment {
    path: string;
}

type FragmentMenuAction = 'all' | 'category' | 'create' | 'edit' | 'delete' | 'back' | 'separator';

class FragmentsCommand extends BaseCommand {
    constructor() {
        super('fragments', 'Manage prompt fragments');
        this.addCommand(createCommand)
            .addCommand(editCommand)
            .addCommand(deleteCommand)
            .option('--list', 'List all available fragments')
            .option('--categories', 'List all fragment categories')
            .option('--search <keyword>', 'Search fragments by keyword')
            .option('--json', 'Output in JSON format (for CI use)')
            .addHelpText('before', chalk.bold(chalk.cyan('\n📝 Prompt Library - Fragments Management\n')))
            .addHelpText(
                'after',
                `
Examples:
  $ prompt-library-cli fragments               Browse and view fragments interactively
  $ prompt-library-cli fragments --list        List all available fragments
  $ prompt-library-cli fragments --categories  List all fragment categories
  $ prompt-library-cli fragments --search "formatting"  Search fragments by keyword
  $ prompt-library-cli fragments create        Create a new fragment
  $ prompt-library-cli fragments edit          Edit an existing fragment
  $ prompt-library-cli fragments delete        Delete a fragment
  $ prompt-library-cli fragments create --category prompt_engineering --name my_fragment  Create a specific fragment
                `
            )
            .action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        const hasList = process.argv.includes('--list');
        const hasCategories = process.argv.includes('--categories');
        const hasJson = process.argv.includes('--json');
        const searchIndex = process.argv.indexOf('--search');
        let searchTerm = null;

        if (searchIndex !== -1 && searchIndex < process.argv.length - 1) {
            searchTerm = process.argv[searchIndex + 1];
        }

        if (hasList) {
            return this.listAllFragmentsForCI(hasJson);
        }

        if (hasCategories) {
            return this.listAllCategoriesForCI(hasJson);
        }

        if (searchTerm) {
            return this.searchFragments(searchTerm, hasJson);
        }

        while (true) {
            try {
                console.clear();
                printSectionHeader('Prompt Fragments', '🧩');
                
                const choices = [];
                choices.push(createSectionHeader<FragmentMenuAction>('BROWSE', '🔍', 'info'));
                choices.push(formatMenuItem('By category', 'category', 'primary'));
                choices.push(formatMenuItem('All fragments', 'all', 'primary'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                choices.push(createSectionHeader<FragmentMenuAction>('MANAGE', '🔧', 'info'));
                choices.push(formatMenuItem('Create new fragment', 'create', 'success'));
                choices.push(formatMenuItem('Edit fragment', 'edit', 'warning'));
                choices.push(formatMenuItem('Delete fragment', 'delete', 'danger'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                const action = await this.showMenu<FragmentMenuAction>(
                    'Use ↑↓ to select an action:',
                    choices as Array<{
                        name: string;
                        value: FragmentMenuAction;
                        disabled?: boolean | string;
                    }>,
                    {
                        clearConsole: false,
                    }
                );

                if (action === 'back') {
                    return;
                }

                if (action === 'create') {
                    await createCommand.parseAsync([]);
                    continue;
                }

                if (action === 'edit') {
                    await editCommand.parseAsync([]);
                    continue;
                }

                if (action === 'delete') {
                    await deleteCommand.parseAsync([]);
                    continue;
                }

                // Always fetch a fresh list of fragments from disk
                const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');

                if (!fragments) continue;

                if (action === 'all') {
                    await this.viewAllFragments(fragments);
                } else {
                    await this.viewFragmentsByCategory(fragments);
                }
            } catch (error) {
                this.handleError(error, 'fragments menu');
                await this.pressKeyToContinue();
            }
        }
    }

    private async viewAllFragments(fragments: PromptFragment[]): Promise<void> {
        const sortedFragments = fragments.sort((a, b) =>
            `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`)
        );
        await this.viewFragmentMenu(sortedFragments);
    }

    private async viewFragmentsByCategory(fragments: PromptFragment[]): Promise<void> {
        const categories = [...new Set(fragments.map((f) => f.category))].sort();
        while (true) {
            console.clear();
            printSectionHeader('Fragment Categories', '🧩');
            
            // Calculate counts for each category
            const countByCategory: Record<string, number> = {};
            fragments.forEach(fragment => {
                countByCategory[fragment.category] = (countByCategory[fragment.category] || 0) + 1;
            });
            
            // Format table data
            const maxCategoryLength = Math.max(...categories.map(c => c.length), 'Category'.length);
            const tableWidth = maxCategoryLength + 20; // Add space for count
            
            // Create headers
            const headers = `${chalk.bold('Category'.padEnd(maxCategoryLength + 2))}${chalk.bold('Count')}`;
            const separator = '─'.repeat(tableWidth);
            
            // Create menu choices that look like a table
            const tableChoices: Array<{ name: string; value: string | 'back'; disabled?: boolean }> = [];
            
            // Add a header row
            tableChoices.push({
                name: headers,
                value: 'back',
                disabled: true
            });
            
            // Add a separator
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add each row as a selectable item
            categories.forEach(category => {
                tableChoices.push({
                    name: `${chalk.green(category.padEnd(maxCategoryLength + 2))}${chalk.yellow(countByCategory[category].toString())}`,
                    value: category
                });
            });
            
            // Add a separator at the bottom
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add info
            tableChoices.push({
                name: chalk.italic(`Found ${categories.length} categories.`),
                value: 'back',
                disabled: true
            });
            
            // Add a back option with danger formatting
            tableChoices.push({
                name: formatMenuItem('Go back', 'back', 'danger').name,
                value: 'back'
            });

            const category = await this.showMenu<string | 'back'>(
                'Use ↑↓ to select a category:',
                tableChoices,
                {
                    clearConsole: false,
                    includeGoBack: false
                }
            );

            if (category === 'back') {
                return;
            }

            const categoryFragments = fragments.filter((f) => f.category === category);
            await this.viewFragmentMenu(categoryFragments);
        }
    }

    private async viewFragmentMenu(fragments: PromptFragment[]): Promise<void> {
        while (true) {
            console.clear();
            
            // Determine an appropriate header title
            let headerTitle = 'Available Fragments';
            
            // If all fragments have the same category, show that in the header
            if (fragments.length > 0) {
                const firstCategory = fragments[0].category;
                const allSameCategory = fragments.every(f => f.category === firstCategory);
                
                if (allSameCategory) {
                    headerTitle = `Fragments in ${formatTitleCase(firstCategory)}`;
                }
            }
            
            // Print the section header
            printSectionHeader(headerTitle, '🧩');
            
            // Format table data
            const { headers, rows, separator, fragmentsMap } = this.formatFragmentsTable(fragments);
            
            // Create menu choices that look like a table
            const tableChoices: Array<{ name: string; value: PromptFragment | 'back'; disabled?: boolean }> = [];
            
            // Add a header row
            tableChoices.push({
                name: headers,
                value: 'back',
                disabled: true
            });
            
            // Add a separator
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add each row as a selectable item
            rows.forEach((row: string, index: number) => {
                if (row.trim() !== '') { // Ensure it's not just an empty row
                    tableChoices.push({
                        name: row,
                        value: fragmentsMap[index]
                    });
                }
            });
            
            // Add a separator at the bottom
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add info
            tableChoices.push({
                name: chalk.italic(`Found ${fragments.length} fragments.`),
                value: 'back',
                disabled: true
            });

            const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
                'Use ↑↓ to select a fragment:',
                tableChoices,
                {
                    clearConsole: false,
                    includeGoBack: true
                }
            );

            if (selectedFragment === 'back') {
                return;
            }

            await this.displayFragmentContent(selectedFragment as PromptFragment);
        }
    }

    private formatFragmentsTable(fragments: PromptFragment[]): {
        headers: string;
        rows: string[];
        separator: string;
        fragmentsMap: PromptFragment[];
    } {
        // Just reuse the shared formatter
        return formatFragmentsTable(fragments);
    }
    
    private async editSelectedFragment(fragment: PromptFragment): Promise<void> {
        try {
            const content = await this.handleApiResult(
                await viewFragmentContent(fragment.category, fragment.name),
                `Fetched content for fragment ${fragment.category}/${fragment.name}`
            );
            
            if (!content) {
                console.log(chalk.yellow(`Could not load content for fragment ${fragment.category}/${fragment.name}`));
                return;
            }
            
            console.log(chalk.cyan('Editing fragment:'), `${formatTitleCase(fragment.category)} > ${fragment.name}`);
            
            // Prompt the user to edit the content
            const newContent = await this.getMultilineInput('Edit content:', content);
            
            // Use the edit command's backend function directly to update the fragment
            const success = await editCommandWithMethods.editFragment(fragment.category, fragment.name, newContent);
            
            // Create an ApiResult-like object to match the expected type
            const result = await this.handleApiResult(
                { success, data: true, error: success ? undefined : 'Failed to edit fragment' },
                'Updated fragment'
            );
            
            if (result) {
                console.log(chalk.green(`Successfully updated fragment ${fragment.category}/${fragment.name}`));
            }
        } catch (error) {
            this.handleError(error, 'editing fragment');
        }
    }
    
    private async deleteSelectedFragment(fragment: PromptFragment): Promise<boolean> {
        try {
            console.log(chalk.yellow(`About to delete fragment: ${formatTitleCase(fragment.category)} > ${fragment.name}`));
            
            // Confirm deletion
            const confirmed = await this.confirmAction(
                chalk.red('Are you sure you want to delete this fragment? This action cannot be undone.')
            );
            
            if (!confirmed) {
                console.log(chalk.yellow('Delete operation cancelled.'));
                return false;
            }
            
            // Use the delete command's backend function directly to delete the fragment
            const success = await deleteCommandWithMethods.deleteFragment(fragment.category, fragment.name);
            
            // Create an ApiResult-like object to match the expected type
            const result = await this.handleApiResult(
                { success, data: true, error: success ? undefined : 'Failed to delete fragment' },
                'Deleted fragment'
            );
            
            if (result) {
                console.log(chalk.green(`Successfully deleted fragment ${fragment.category}/${fragment.name}`));
                return true;
            } else {
                return false;
            }
        } catch (error) {
            this.handleError(error, 'deleting fragment');
            return false;
        }
    }
    
    private async displayFragmentContent(fragment: PromptFragment): Promise<void> {
        try {
            const content = await this.handleApiResult(
                await viewFragmentContent(fragment.category, fragment.name),
                `Fetched content for fragment ${fragment.category}/${fragment.name}`
            );

            if (content) {
                printSectionHeader('Fragment Details');
                console.log(chalk.cyan('Category:'), formatTitleCase(fragment.category));
                console.log(chalk.cyan('Name:'), fragment.name);
                console.log('─'.repeat(80));
                console.log(chalk.cyan('Content:'));
                console.log(content);
                console.log('─'.repeat(80));

                const action = await this.showMenu<'edit' | 'delete' | 'back'>(
                    'Actions:',
                    [
                        formatMenuItem('Edit this fragment', 'edit', 'warning'),
                        formatMenuItem('Delete this fragment', 'delete', 'danger'),
                        formatMenuItem('Go back', 'back', 'danger')
                    ],
                    { clearConsole: false, includeGoBack: false }
                );

                if (action === 'edit') {
                    await this.editSelectedFragment(fragment);
                    // Return to fragment list after editing without confirmation
                    return;
                } else if (action === 'delete') {
                    const success = await this.deleteSelectedFragment(fragment);
                    // Return to fragment list after deleting without confirmation
                    // The parent method will refresh the fragments list when we return
                    return;
                } else if (action === 'back') {
                    // Return to fragment list without confirmation
                    return;
                }
            }
        } catch (error) {
            this.handleError(error, 'viewing fragment content');
            // Show "press key to continue" on error
            await this.pressKeyToContinue();
        }
        // Remove the "press key to continue" from the finally block
    }

    private async listAllFragmentsForCI(json: boolean): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            const allFragments = fragmentsResult.map((fragment) => ({
                ...fragment,
                path: `fragments/${fragment.category}/${fragment.name}`
            }));

            if (json) {
                console.log(JSON.stringify(allFragments, null, 2));
            } else {
                console.log(chalk.bold('\n🧩 Available Fragments:'));
                console.log('─'.repeat(80));

                const maxCategoryLength = Math.max(...allFragments.map((f) => f.category.length), 'CATEGORY'.length);
                const maxNameLength = Math.max(...allFragments.map((f) => f.name.length), 'NAME'.length);
                console.log(
                    chalk.cyan('CATEGORY'.padEnd(maxCategoryLength + 4)) +
                        chalk.cyan('NAME'.padEnd(maxNameLength + 4)) +
                        chalk.cyan('PATH')
                );
                console.log('─'.repeat(80));

                const fragmentsByCategory: Record<string, ExpandedPromptFragment[]> = {};
                allFragments.forEach((fragment) => {
                    if (!fragmentsByCategory[fragment.category]) {
                        fragmentsByCategory[fragment.category] = [];
                    }

                    fragmentsByCategory[fragment.category].push(fragment);
                });

                const sortedCategories = Object.keys(fragmentsByCategory).sort();
                sortedCategories.forEach((category) => {
                    const fragments = fragmentsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
                    fragments.forEach((fragment) => {
                        console.log(
                            chalk.green(fragment.category.padEnd(maxCategoryLength + 4)) +
                                chalk.yellow(fragment.name.padEnd(maxNameLength + 4)) +
                                fragment.path
                        );
                    });
                });

                console.log('─'.repeat(80));
                console.log(
                    chalk.italic(
                        '\nTip: Use these fragments in your prompts with {% raw %}{{FRAGMENT_NAME}}{% endraw %}\n'
                    )
                );
            }
        } catch (error) {
            this.handleError(error, 'listing fragments');
        }
    }

    private async listAllCategoriesForCI(json: boolean): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            const categories = Array.from(new Set(fragmentsResult.map((f) => f.category))).sort();

            if (json) {
                console.log(JSON.stringify(categories, null, 2));
            } else {
                console.log(chalk.bold('\n📚 Fragment Categories:'));
                console.log('─'.repeat(80));

                const countByCategory: Record<string, number> = {};
                fragmentsResult.forEach((fragment) => {
                    countByCategory[fragment.category] = (countByCategory[fragment.category] || 0) + 1;
                });

                categories.forEach((category) => {
                    console.log(
                        chalk.green(formatTitleCase(category).padEnd(30)) +
                            chalk.yellow(`${countByCategory[category]} fragments`)
                    );
                });

                console.log('─'.repeat(80));
                console.log(chalk.italic('\nView fragments by category:'));
                console.log(chalk.italic(`  prompt-library-cli fragments\n`));
            }
        } catch (error) {
            this.handleError(error, 'listing fragment categories');
        }
    }

    private async searchFragments(keyword: string, json: boolean): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            const matchingFragments = fragmentsResult
                .filter(
                    (fragment) =>
                        fragment.name.toLowerCase().includes(keyword.toLowerCase()) ||
                        fragment.category.toLowerCase().includes(keyword.toLowerCase())
                )
                .map((fragment) => ({
                    ...fragment,
                    path: `fragments/${fragment.category}/${fragment.name}`
                }));

            if (matchingFragments.length === 0) {
                console.log(chalk.yellow(`\nNo fragments found matching '${keyword}'`));
                return;
            }

            if (json) {
                console.log(JSON.stringify(matchingFragments, null, 2));
            } else {
                console.log(chalk.bold(`\n🔍 Found ${matchingFragments.length} fragments matching '${keyword}':`));
                console.log('─'.repeat(80));

                const maxCategoryLength = Math.max(
                    ...matchingFragments.map((f) => f.category.length),
                    'CATEGORY'.length
                );
                const maxNameLength = Math.max(...matchingFragments.map((f) => f.name.length), 'NAME'.length);
                console.log(
                    chalk.cyan('CATEGORY'.padEnd(maxCategoryLength + 4)) +
                        chalk.cyan('NAME'.padEnd(maxNameLength + 4)) +
                        chalk.cyan('PATH')
                );
                console.log('─'.repeat(80));

                matchingFragments
                    .sort((a, b) => {
                        if (a.category !== b.category) {
                            return a.category.localeCompare(b.category);
                        }
                        return a.name.localeCompare(b.name);
                    })
                    .forEach((fragment) => {
                        console.log(
                            chalk.green(fragment.category.padEnd(maxCategoryLength + 4)) +
                                chalk.yellow(fragment.name.padEnd(maxNameLength + 4)) +
                                fragment.path
                        );
                    });

                console.log('─'.repeat(80));
                console.log(chalk.italic('\nTo view a fragment:'));
                console.log(chalk.italic(`  prompt-library-cli fragments\n`));
            }
        } catch (error) {
            this.handleError(error, 'searching fragments');
        }
    }
}

export default new FragmentsCommand();
