import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { PromptFragment } from '../../shared/types';
import { formatTitleCase } from '../../shared/utils/string-formatter';
import { listFragments, viewFragmentContent } from '../utils/fragments';

type FragmentMenuAction = 'all' | 'category' | 'back';

class FragmentsCommand extends BaseCommand {
    constructor() {
        super('fragments', 'List and view fragments');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                const action = await this.showMenu<FragmentMenuAction>('Select an action:', [
                    { name: 'View fragments by category', value: 'category' },
                    { name: 'View all fragments', value: 'all' }
                ]);

                if (action === 'back') {
                    return;
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
            const category = await this.showMenu<string | 'back'>(
                'Select a category:',
                categories.map((c) => ({ name: formatTitleCase(c), value: c }))
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
            const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
                'Select a fragment to view:',
                fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} > ${chalk.green(f.name)}`,
                    value: f
                }))
            );

            if (selectedFragment === 'back') {
                return;
            }

            await this.displayFragmentContent(selectedFragment);
        }
    }

    private async displayFragmentContent(fragment: PromptFragment): Promise<void> {
        try {
            const content = await this.handleApiResult(
                await viewFragmentContent(fragment.category, fragment.name),
                `Fetched content for fragment ${fragment.category}/${fragment.name}`
            );

            if (content) {
                console.log(chalk.red(chalk.bold('\nFragment content:')));
                console.log(chalk.cyan('Category:'), formatTitleCase(fragment.category));
                console.log(chalk.cyan('Name:'), fragment.name);
                console.log(chalk.cyan('Content:'));
                console.log(content);
            }
        } catch (error) {
            this.handleError(error, 'viewing fragment content');
        } finally {
            await this.pressKeyToContinue();
        }
    }
}

export default new FragmentsCommand();
