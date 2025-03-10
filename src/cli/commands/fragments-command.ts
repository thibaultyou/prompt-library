import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { createCommand, editCommand, deleteCommand } from './fragment-commands';
import { PromptFragment } from '../../shared/types';
import { formatTitleCase } from '../../shared/utils/string-formatter';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { createCategoryHeader, createSectionHeader, formatMenuItem, printSectionHeader } from '../utils/ui-components';

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
  $ prompt-library-cli fragments create -c prompt_engineering -n my_fragment  Create a specific fragment
                `
            )
            .action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        // Check for command-line arguments directly
        const hasList = process.argv.includes('--list');
        const hasCategories = process.argv.includes('--categories');
        const hasJson = process.argv.includes('--json');
        // Find search term if present
        const searchIndex = process.argv.indexOf('--search');
        let searchTerm = null;

        if (searchIndex !== -1 && searchIndex < process.argv.length - 1) {
            searchTerm = process.argv[searchIndex + 1];
        }
        
        // Use direct argument detection
        if (hasList) {
            return this.listAllFragmentsForCI(hasJson);
        }
        
        if (hasCategories) {
            return this.listAllCategoriesForCI(hasJson);
        }
        
        if (searchTerm) {
            return this.searchFragments(searchTerm, hasJson);
        }
        
        // Commander options not being used due to detection issue
        // We're using direct process.argv checking instead
        
        // If no options, show interactive menu
        while (true) {
            try {
                const choices = [];
                choices.push(createSectionHeader<FragmentMenuAction>('BROWSE', '🔍', 'primary'));
                choices.push(formatMenuItem('By Category', 'category', 'primary'));
                choices.push(formatMenuItem('All Fragments', 'all', 'primary'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                choices.push(createSectionHeader<FragmentMenuAction>('MANAGE', '✏️', 'success'));
                choices.push(formatMenuItem('Create New Fragment', 'create', 'success'));
                choices.push(formatMenuItem('Edit Fragment', 'edit', 'warning'));
                choices.push(formatMenuItem('Delete Fragment', 'delete', 'danger'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });
                choices.push({
                    name: chalk.italic('To run a prompt, use the "Run a prompt" option from the main menu'),
                    value: 'back',
                    disabled: ' '
                });

                const action = await this.showMenu<FragmentMenuAction>(
                    'Select an action:',
                    choices as Array<{
                        name: string;
                        value: FragmentMenuAction;
                        disabled?: boolean | string;
                    }>
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
            const choices = categories.map((category) => ({
                name: chalk.bold(formatTitleCase(category)),
                value: category
            }));
            const category = await this.showMenu<string | 'back'>('Select a category:', choices);

            if (category === 'back') {
                return;
            }

            const categoryFragments = fragments.filter((f) => f.category === category);
            await this.viewFragmentMenu(categoryFragments);
        }
    }

    private async viewFragmentMenu(fragments: PromptFragment[]): Promise<void> {
        while (true) {
            const fragmentsByCategory: Record<string, PromptFragment[]> = {};
            fragments.forEach((fragment) => {
                if (!fragmentsByCategory[fragment.category]) {
                    fragmentsByCategory[fragment.category] = [];
                }

                fragmentsByCategory[fragment.category].push(fragment);
            });

            const choices: Array<{ name: string; value: PromptFragment | 'back'; disabled?: boolean }> = [];
            const sortedCategories = Object.keys(fragmentsByCategory).sort();

            for (const category of sortedCategories) {
                choices.push({
                    name: createCategoryHeader(formatTitleCase(category)).name,
                    value: 'back' as const,
                    disabled: true
                });

                const sortedFragments = fragmentsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
                sortedFragments.forEach((fragment) => {
                    choices.push({
                        name: formatMenuItem(`  ${fragment.name}`, fragment, 'success').name,
                        value: fragment
                    });
                });
            }

            const selectedFragment = await this.showMenu<PromptFragment | 'back'>('Select a fragment:', choices, {
                clearConsole: true
            });

            if (selectedFragment === 'back') {
                return;
            }

            await this.displayFragmentContent(selectedFragment as PromptFragment);
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
                        formatMenuItem('Delete this fragment', 'delete', 'danger')
                    ],
                    { clearConsole: false }
                );

                if (action === 'edit') {
                    await editCommand.parseAsync(['-c', fragment.category, '-n', fragment.name]);
                } else if (action === 'delete') {
                    await deleteCommand.parseAsync(['-c', fragment.category, '-n', fragment.name]);
                }
            }
        } catch (error) {
            this.handleError(error, 'viewing fragment content');
        } finally {
            await this.pressKeyToContinue();
        }
    }

    private async listAllFragmentsForCI(json: boolean): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            const allFragments = fragmentsResult.map(fragment => ({
                ...fragment,
                path: `fragments/${fragment.category}/${fragment.name}`
            }));

            if (json) {
                console.log(JSON.stringify(allFragments, null, 2));
            } else {
                console.log(chalk.bold('\n🧩 Available Fragments:'));
                console.log('─'.repeat(80));
                
                // Calculate max lengths for formatting
                const maxCategoryLength = Math.max(...allFragments.map(f => f.category.length), 'CATEGORY'.length);
                const maxNameLength = Math.max(...allFragments.map(f => f.name.length), 'NAME'.length);
                // Print header
                console.log(
                    chalk.cyan('CATEGORY'.padEnd(maxCategoryLength + 4)) +
                    chalk.cyan('NAME'.padEnd(maxNameLength + 4)) +
                    chalk.cyan('PATH')
                );
                console.log('─'.repeat(80));

                // Group by category
                const fragmentsByCategory: Record<string, ExpandedPromptFragment[]> = {};
                allFragments.forEach(fragment => {
                    if (!fragmentsByCategory[fragment.category]) {
                        fragmentsByCategory[fragment.category] = [];
                    }

                    fragmentsByCategory[fragment.category].push(fragment);
                });

                // Print fragments by category
                const sortedCategories = Object.keys(fragmentsByCategory).sort();
                sortedCategories.forEach(category => {
                    const fragments = fragmentsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
                    fragments.forEach(fragment => {
                        console.log(
                            chalk.green(fragment.category.padEnd(maxCategoryLength + 4)) +
                            chalk.yellow(fragment.name.padEnd(maxNameLength + 4)) +
                            fragment.path
                        );
                    });
                });

                console.log('─'.repeat(80));
                console.log(chalk.italic('\nTip: Use these fragments in your prompts with {% raw %}{{FRAGMENT_NAME}}{% endraw %}\n'));
            }
        } catch (error) {
            this.handleError(error, 'listing fragments');
        }
    }

    private async listAllCategoriesForCI(json: boolean): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            // Get unique categories
            const categories = Array.from(new Set(fragmentsResult.map(f => f.category))).sort();

            if (json) {
                console.log(JSON.stringify(categories, null, 2));
            } else {
                console.log(chalk.bold('\n📚 Fragment Categories:'));
                console.log('─'.repeat(80));
                
                // Count fragments per category
                const countByCategory: Record<string, number> = {};
                fragmentsResult.forEach(fragment => {
                    countByCategory[fragment.category] = (countByCategory[fragment.category] || 0) + 1;
                });
                
                // Print categories with counts
                categories.forEach(category => {
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

            // Search by name or category
            const matchingFragments = fragmentsResult.filter(fragment => 
                fragment.name.toLowerCase().includes(keyword.toLowerCase()) ||
                fragment.category.toLowerCase().includes(keyword.toLowerCase())
            ).map(fragment => ({
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
                
                // Calculate max lengths for formatting
                const maxCategoryLength = Math.max(...matchingFragments.map(f => f.category.length), 'CATEGORY'.length);
                const maxNameLength = Math.max(...matchingFragments.map(f => f.name.length), 'NAME'.length);
                // Print header
                console.log(
                    chalk.cyan('CATEGORY'.padEnd(maxCategoryLength + 4)) +
                    chalk.cyan('NAME'.padEnd(maxNameLength + 4)) +
                    chalk.cyan('PATH')
                );
                console.log('─'.repeat(80));

                // Sort by category then name
                matchingFragments.sort((a, b) => {
                    if (a.category !== b.category) {
                        return a.category.localeCompare(b.category);
                    }
                    return a.name.localeCompare(b.name);
                }).forEach(fragment => {
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
