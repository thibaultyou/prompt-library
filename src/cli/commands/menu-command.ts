import chalk from 'chalk';
import { Command } from 'commander';

import { BaseCommand } from './base-command';
import { getConfig, getConfigValue } from '../../shared/config';
import { getRecentExecutions } from '../utils/database';
import { handleError } from '../utils/errors';
import { hasFragments, hasPrompts } from '../utils/file-system';
import { hasLibraryRepositoryChanges } from '../utils/library-repository';
import { createSectionHeader, formatMenuItem, printSectionHeader, warningMessage } from '../utils/ui-components';

type MenuAction =
    | 'sync'
    | 'prompts'
    | 'fragments'
    | 'env'
    | 'model'
    | 'config'
    | 'flush'
    | 'back'
    | 'last_prompt'
    | 'search_prompts'
    | 'favorites'
    | 'recent'
    | 'header'
    | 'spacer'
    | 'space'
    | 'quick_actions_header'
    | 'menu_header'
    | 'config_header'
    | 'repo_header'
    | 'list_changes'
    | 'reset_changes'
    | 'push_changes';

interface MenuItem {
    name: string;
    value: MenuAction;
    type?: 'header' | 'item' | 'separator';
    description?: string;
    disabled?: boolean | string;
}

class MenuCommand extends BaseCommand {
    constructor(private program: Command) {
        super('menu', 'Main menu for the CLI');
    }

    async execute(): Promise<void> {
        let firstRun = true;
        while (true) {
            try {
                const config = getConfig();
                const [promptsExist, fragmentsExist] = await Promise.all([hasPrompts(), hasFragments()]);

                if (firstRun) {
                    console.clear();
                    firstRun = false;
                }

                if (!config.REMOTE_REPOSITORY || (!promptsExist && !fragmentsExist)) {
                    printSectionHeader('Setup Required');
                    console.log(warningMessage('No prompts found. You should sync with the repository first.'));

                    const setupAction = await this.showMenu<'sync' | 'continue' | 'back'>(
                        'Would you like to sync now?',
                        [
                            { name: chalk.bold(chalk.green('Yes, sync with repository')), value: 'sync' },
                            { name: 'No, continue to menu', value: 'continue' }
                        ],
                        { goBackLabel: 'Exit', clearConsole: false }
                    );

                    if (setupAction === 'back') {
                        console.log(chalk.yellow('Goodbye!'));
                        return;
                    }

                    if (setupAction === 'sync') {
                        await this.runCommand(this.program, 'sync', { clearConsole: true });
                        continue;
                    }
                }

                const choices: MenuItem[] = [];
                const modelProvider = getConfigValue('MODEL_PROVIDER');
                const modelName = getConfigValue(modelProvider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL');
                const repoUrl = getConfigValue('REMOTE_REPOSITORY');
                const hasPendingChanges = await hasLibraryRepositoryChanges();
                console.log(chalk.bold(chalk.cyan(`🧠 Prompt Library CLI`)));
                console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProvider)} / ${chalk.cyan(modelName)}`);

                let repoDisplay = chalk.gray('Not configured');

                if (repoUrl) {
                    const displayUrl = repoUrl.length > 50 ? repoUrl.substring(0, 47) + '...' : repoUrl;
                    repoDisplay = chalk.cyan(displayUrl);
                }

                console.log(`${chalk.gray('Repository:')} ${repoDisplay}`);
                console.log(
                    `${chalk.gray('Status:')} ${hasPendingChanges ? chalk.yellow('⚠️  Changes pending') : chalk.green('✓ Up to date')}`
                );

                let recentPrompts: any[] = [];

                try {
                    recentPrompts = await getRecentExecutions(3);
                } catch {
                    // Silently handle errors when retrieving recent executions
                }

                if (recentPrompts && recentPrompts.length > 0) {
                    choices.push({
                        name: createSectionHeader<MenuAction>('QUICK ACTIONS', '✨', 'success').name,
                        value: 'quick_actions_header',
                        disabled: 'HEADER'
                    });

                    if (recentPrompts.length > 0) {
                        const lastPrompt = recentPrompts[0];
                        choices.push({
                            name: formatMenuItem(
                                `Run last prompt: ${chalk.italic(lastPrompt.title || 'Unknown')}`,
                                'last_prompt',
                                'success'
                            ).name,
                            value: 'last_prompt',
                            description: lastPrompt.id
                        });
                    }

                    choices.push({
                        name: formatMenuItem('Search prompts by keyword', 'search_prompts', 'success').name,
                        value: 'search_prompts'
                    });

                    choices.push({
                        name: '─'.repeat(50),
                        value: 'spacer',
                        disabled: true
                    });
                }

                choices.push({
                    name: createSectionHeader<MenuAction>('MAIN MENU', '📚', 'info').name,
                    value: 'menu_header',
                    disabled: 'HEADER'
                });

                choices.push(
                    {
                        name: formatMenuItem('Prompts Library', 'prompts', 'primary').name,
                        value: 'prompts'
                    },
                    {
                        name: formatMenuItem('Prompt Fragments', 'fragments', 'primary').name,
                        value: 'fragments'
                    },
                    {
                        name: formatMenuItem('Environment Variables', 'env', 'primary').name,
                        value: 'env'
                    }
                );

                choices.push({
                    name: createSectionHeader<MenuAction>('CONFIGURATION', '⚙️', 'info').name,
                    value: 'config_header',
                    disabled: 'HEADER'
                });

                choices.push(
                    {
                        name: formatMenuItem('Configure AI Model', 'model', 'primary').name,
                        value: 'model'
                    },
                    {
                        name: formatMenuItem('Configure CLI', 'config', 'primary').name,
                        value: 'config'
                    },
                    {
                        name: formatMenuItem('Flush and Reset Data', 'flush', 'primary').name,
                        value: 'flush'
                    }
                );

                choices.push({
                    name: createSectionHeader<MenuAction>('REPOSITORY', '🔄', 'warning').name,
                    value: 'repo_header',
                    disabled: 'HEADER'
                });

                const syncChoices: MenuItem[] = [
                    {
                        name: formatMenuItem('Sync with remote repository', 'sync', 'warning').name,
                        value: 'sync'
                    }
                ];

                if (hasPendingChanges) {
                    syncChoices.push({
                        name: formatMenuItem('List pending changes', 'list_changes', 'warning').name,
                        value: 'list_changes' as MenuAction
                    });

                    syncChoices.push({
                        name: formatMenuItem('Reset/discard changes', 'reset_changes', 'warning').name,
                        value: 'reset_changes' as MenuAction
                    });

                    syncChoices.push({
                        name: formatMenuItem('Push changes to remote', 'push_changes', 'warning').name,
                        value: 'push_changes' as MenuAction
                    });
                }

                choices.push(...syncChoices);

                const displayChoices = choices;
                const action = await this.showMenu<MenuAction>('Select an action:', displayChoices, {
                    goBackLabel: 'Exit',
                    clearConsole: false
                });

                if (action === 'back') {
                    console.log(chalk.yellow('Goodbye!'));
                    return;
                }

                if (action === 'last_prompt') {
                    const lastPromptChoice = choices.find((c) => c.value === 'last_prompt');

                    if (lastPromptChoice && lastPromptChoice.description) {
                        const executeCmd = this.program.commands.find((cmd) => cmd.name() === 'execute');

                        if (executeCmd) {
                            await executeCmd.parseAsync([
                                'node',
                                'script.js',
                                'execute',
                                '-p',
                                lastPromptChoice.description
                            ]);
                        }
                    }
                } else if (action === 'search_prompts') {
                    const keyword = await this.getInput('Enter search keyword:');

                    if (keyword && keyword.trim()) {
                        const promptsCmd = this.program.commands.find((cmd) => cmd.name() === 'prompts');

                        if (promptsCmd) {
                            await promptsCmd.parseAsync(['node', 'script.js', 'prompts', '--search', keyword.trim()]);
                        }
                    }
                } else if (action === 'list_changes') {
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');

                    if (syncCmd) {
                        await syncCmd.parseAsync(['node', 'script.js', 'sync', '--list']);
                    }
                } else if (action === 'reset_changes') {
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');

                    if (syncCmd) {
                        await syncCmd.parseAsync(['node', 'script.js', 'sync', '--reset']);
                    }
                } else if (action === 'push_changes') {
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');

                    if (syncCmd) {
                        await syncCmd.parseAsync(['node', 'script.js', 'sync', '--push']);
                    }
                } else if (action === 'recent') {
                    const promptsCmd = this.program.commands.find((cmd) => cmd.name() === 'prompts');

                    if (promptsCmd) {
                        await promptsCmd.parseAsync(['node', 'script.js', 'prompts', '--recent']);
                        console.clear();
                        firstRun = true;
                        continue;
                    }
                } else if (action === 'favorites') {
                    const promptsCmd = this.program.commands.find((cmd) => cmd.name() === 'prompts');

                    if (promptsCmd) {
                        await promptsCmd.parseAsync(['node', 'script.js', 'prompts', '--favorites']);
                        console.clear();
                        firstRun = true;
                        continue;
                    }
                } else {
                    await this.runCommand(this.program, action, { clearConsole: true });
                }

                firstRun = true;
            } catch (error) {
                this.handleError(error, 'menu command');
                await this.pressKeyToContinue();
            }
        }
    }
}

export async function showMainMenu(program: Command): Promise<void> {
    try {
        const menuCommand = new MenuCommand(program);
        await menuCommand.execute();
    } catch (error) {
        handleError(error, 'show main menu');
    }
}
