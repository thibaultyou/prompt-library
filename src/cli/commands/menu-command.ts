import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';

import { BaseCommand, LIBRARY_PROMPTS_DIR, LIBRARY_FRAGMENTS_DIR } from './base-command';
import promptsCommand from './prompts-command';
import { getConfig, getConfigValue } from '../../shared/config';
import { formatRelativeTime } from '../../shared/utils/string-formatter';
import { cache, getPromptById, getRecentExecutions, hasFavoritePrompts } from '../utils/database';
import { handleError } from '../utils/errors';
import { hasFragments, hasPrompts } from '../utils/file-system';
import { hasLibraryRepositoryChanges } from '../utils/library-repository';
import { getPromptCategories } from '../utils/prompt-utils';
import { diffDirectories } from '../utils/sync-utils';
import { createSectionHeader, formatMenuItem, getInput, printSectionHeader, warningMessage } from '../utils/ui-components';

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
    | 'repository'
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
                printSectionHeader('Prompt Library CLI', '🧠');
                console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProvider)} / ${chalk.cyan(modelName)}`);

                let repoDisplay = chalk.gray('Not configured');

                if (repoUrl) {
                    const displayUrl = repoUrl.length > 50 ? repoUrl.substring(0, 47) + '...' : repoUrl;
                    repoDisplay = chalk.cyan(displayUrl);
                }

                console.log(`${chalk.gray('Repository:')} ${repoDisplay}`);
                console.log(
                    `${chalk.gray('Status:')} ${hasPendingChanges ? chalk.yellow('⚠️ Changes pending') : chalk.green('✓ Up to date')}`
                );

                let recentPrompts: any[] = [];
                let hasFavorites = false;

                try {
                    recentPrompts = await getRecentExecutions(3);
                    hasFavorites = await hasFavoritePrompts();
                } catch (error) {
                    // Silently handle errors when retrieving data
                }

                choices.push({
                    name: '─'.repeat(50),
                    value: 'spacer',
                    disabled: ' '
                });

                choices.push({
                    name: createSectionHeader<MenuAction>('QUICK ACTIONS', '✨', 'success').name,
                    value: 'quick_actions_header',
                    disabled: ' '
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
                
                if (hasFavorites) {
                    choices.push({
                        name: formatMenuItem('Favorite prompts', 'favorites', 'success').name,
                        value: 'favorites'
                    });
                }

                choices.push({
                    name: formatMenuItem('Search prompts by keyword', 'search_prompts', 'success').name,
                    value: 'search_prompts'
                });

                choices.push({
                    name: '─'.repeat(50),
                    value: 'spacer',
                    disabled: ' '
                });

                choices.push({
                    name: createSectionHeader<MenuAction>('LIBRARY', '📚', 'info').name,
                    value: 'menu_header',
                    disabled: ' '
                });

                choices.push(
                    {
                        name: formatMenuItem('Prompts library', 'prompts', 'primary').name,
                        value: 'prompts'
                    },
                    {
                        name: formatMenuItem('Prompt fragments', 'fragments', 'primary').name,
                        value: 'fragments'
                    },
                    {
                        name: formatMenuItem('Environment variables', 'env', 'primary').name,
                        value: 'env'
                    }
                );

                choices.push({
                    name: '─'.repeat(50),
                    value: 'spacer',
                    disabled: ' '
                });

                choices.push({
                    name: createSectionHeader<MenuAction>('CONFIGURATION', '🔧', 'info').name,
                    value: 'config_header',
                    disabled: ' '
                });

                choices.push(
                    {
                        name: formatMenuItem('Configure AI model', 'model', 'primary').name,
                        value: 'model'
                    },
                    {
                        name: formatMenuItem('Configure CLI', 'config', 'primary').name,
                        value: 'config'
                    }
                );

                choices.push({
                    name: '─'.repeat(50),
                    value: 'spacer',
                    disabled: ' '
                });

                choices.push({
                    name: createSectionHeader<MenuAction>('REPOSITORY', '💾', 'info').name,
                    value: 'repo_header',
                    disabled: ' '
                });

                const repoChoices: MenuItem[] = [
                    {
                        name: formatMenuItem('Sync with remote repository', 'sync', 'primary').name,
                        value: 'sync'
                    },
                    {
                        name: formatMenuItem('Configure repository', 'repository', 'primary').name,
                        value: 'repository'
                    }
                ];

                if (hasPendingChanges) {
                    repoChoices.unshift({
                        name: formatMenuItem('Manage pending changes', 'list_changes', 'warning').name,
                        value: 'list_changes' as MenuAction
                    });
                }

                choices.push(...repoChoices);

                choices.push({
                    name: '─'.repeat(50),
                    value: 'spacer',
                    disabled: ' '
                });

                const displayChoices = choices;
                const action = await this.showMenu<MenuAction>('Use ↑↓ to select an action:', displayChoices, {
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
                        try {
                            const recentExecutions = await getRecentExecutions(1);

                            if (recentExecutions && recentExecutions.length > 0) {
                                const mostRecentPromptId = recentExecutions[0].prompt_id;
                                console.log(chalk.cyan(`Loading prompt details for ID: ${mostRecentPromptId}...`));
                                console.clear();
                                printSectionHeader('Run Last Prompt', '⚡');
                                const promptDetails = await getPromptById(parseInt(mostRecentPromptId.toString()));

                                if (promptDetails) {
                                    const selectedPrompt = {
                                        id: mostRecentPromptId.toString(),
                                        title: promptDetails.title,
                                        category: promptDetails.primary_category,
                                        primary_category: promptDetails.primary_category,
                                        path: promptDetails.directory,
                                        description: promptDetails.description || '',
                                        subcategories: []
                                    };
                                    await promptsCommand.managePrompt(selectedPrompt);

                                    console.clear();
                                    firstRun = true;
                                    continue;
                                } else {
                                    console.log(
                                        chalk.yellow(`Could not find details for prompt ID: ${mostRecentPromptId}`)
                                    );
                                    await this.pressKeyToContinue();
                                    console.clear();
                                    firstRun = true;
                                    continue;
                                }
                            } else {
                                console.log(chalk.yellow('No recent prompt executions found.'));
                                await this.pressKeyToContinue();
                                console.clear();
                                firstRun = true;
                                continue;
                            }
                        } catch (error) {
                            this.handleError(error, 'executing last prompt');
                            await this.pressKeyToContinue();
                            console.clear();
                            firstRun = true;
                            continue;
                        }
                    }
                } else if (action === 'search_prompts') {
                    console.clear();
                    printSectionHeader('Search Prompts', '🔍');
                    const keyword = await getInput('Enter search keyword:', undefined, true);

                    if (keyword && keyword.trim()) {
                        const categories = await getPromptCategories();
                        await promptsCommand.searchPrompts(categories, keyword.trim(), false);
                        console.clear();
                        firstRun = true;
                        continue;
                    }
                } else if (action === 'list_changes') {
                    // Directly show changes without going through sync --list
                    console.clear();
                    
                    // Display header
                    printSectionHeader('Manage Pending Changes', '📋');
                    
                    // Get config and paths
                    const config = getConfig();
                    const cliPromptsDir = config.PROMPTS_DIR;
                    const cliFragmentsDir = config.FRAGMENTS_DIR;
                    
                    try {
                        // Fetch changes
                        const promptChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);
                        const fragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);
                        
                        // Display changes
                        if (promptChanges.length > 0) {
                            console.log(chalk.bold('\nPrompt changes:'));
                            console.log('─'.repeat(100));
                            
                            for (const change of promptChanges) {
                                const pathParts = change.path.split(path.sep);
                                const directory = pathParts[0];
                                const displayName = `Prompt: ${directory}`;
                                const changeTime = new Date();
                                const relativeTime = formatRelativeTime(changeTime);
                                const changeType = change.type === 'deleted' ? 'add' : 
                                                  change.type === 'added' ? 'delete' : 'modify';
                                console.log(
                                    `${
                                        changeType === 'add'
                                            ? chalk.green('add'.padEnd(7))
                                            : changeType === 'modify'
                                              ? chalk.yellow('modify'.padEnd(7))
                                              : chalk.red('delete'.padEnd(7))
                                    } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                                );
                            }
                        }
                        
                        if (fragmentChanges.length > 0) {
                            console.log(chalk.bold('\nFragment changes:'));
                            console.log('─'.repeat(100));
                            
                            for (const change of fragmentChanges) {
                                const pathParts = change.path.split(path.sep);
                                let category = '';
                                let name = '';
                                
                                if (pathParts.length >= 2) {
                                    category = pathParts[0];
                                    name = pathParts[1].replace(/\.md$/, '');
                                } else if (pathParts.length === 1) {
                                    name = pathParts[0].replace(/\.md$/, '');
                                }
                                
                                const displayName = `Fragment: ${category}/${name}`;
                                const changeTime = new Date();
                                const relativeTime = formatRelativeTime(changeTime);
                                const changeType = change.type === 'deleted' ? 'add' : 
                                                  change.type === 'added' ? 'delete' : 'modify';
                                console.log(
                                    `${
                                        changeType === 'add'
                                            ? chalk.green('add'.padEnd(7))
                                            : changeType === 'modify'
                                              ? chalk.yellow('modify'.padEnd(7))
                                              : chalk.red('delete'.padEnd(7))
                                    } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                                );
                            }
                        }
                        
                        // Display options
                        console.log('─'.repeat(100));
                        console.log(
                            chalk.cyan(`\nTotal: ${promptChanges.length + fragmentChanges.length} change(s)`)
                        );
                        
                        const { select } = require('@inquirer/prompts');
                        const action = await select({
                            message: 'What would you like to do?',
                            choices: [
                                { name: 'Push changes to remote repository', value: 'push' },
                                { name: 'Reset/discard changes', value: 'reset' },
                                { name: chalk.red('Go back'), value: 'back' }
                            ]
                        });
                        
                        if (action === 'push') {
                            console.clear();
                            // Run the push command
                            const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');

                            if (syncCmd) {
                                await syncCmd.parseAsync(['node', 'script.js', 'sync', '--push']);
                            }
                        } else if (action === 'reset') {
                            console.clear();
                            // Run the reset command
                            const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');

                            if (syncCmd) {
                                await syncCmd.parseAsync(['node', 'script.js', 'sync', '--reset']);
                            }
                        }
                    } catch (error) {
                        console.error(chalk.red('Error displaying changes:'), error);
                        await this.pressKeyToContinue();
                    }
                    
                    // Reset the menu state
                    console.clear();
                    firstRun = true;
                    continue;
                } else if (action === 'reset_changes') {
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');
                    
                    if (syncCmd) {
                        // Force reset command options
                        if ((syncCmd as any)._optionValues) {
                            (syncCmd as any)._optionValues = {};
                        }
                        
                        try {
                            await syncCmd.parseAsync(['node', 'script.js', 'sync', '--reset']);
                        } catch (error) {
                            this.handleError(error, 'sync reset command');
                            await this.pressKeyToContinue();
                        }
                    }
                    
                    // No matter what, reset the menu state
                    console.clear();
                    firstRun = true;
                    continue;
                } else if (action === 'push_changes') {
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');
                    
                    if (syncCmd) {
                        // Force reset command options
                        if ((syncCmd as any)._optionValues) {
                            (syncCmd as any)._optionValues = {};
                        }
                        
                        try {
                            await syncCmd.parseAsync(['node', 'script.js', 'sync', '--push']);
                        } catch (error) {
                            this.handleError(error, 'sync push command');
                            await this.pressKeyToContinue();
                        }
                    }
                    
                    // No matter what, reset the menu state
                    console.clear();
                    firstRun = true;
                    continue;
                } else if (action === 'recent') {
                    const promptsCmd = this.program.commands.find((cmd) => cmd.name() === 'prompts');

                    if (promptsCmd) {
                        await promptsCmd.parseAsync(['node', 'script.js', 'prompts', '--recent']);
                        console.clear();
                        firstRun = true;
                        continue;
                    }
                } else if (action === 'favorites') {
                    // Call showFavoritePrompts directly instead of going through command parsing
                    try {
                        await promptsCommand.showFavoritePrompts(false);
                    } catch (error) {
                        this.handleError(error, 'showing favorite prompts');
                        await this.pressKeyToContinue();
                    }
                    
                    // Reset menu state
                    console.clear();
                    firstRun = true;
                    continue;
                } else if (action === 'repository') {
                    const repoCmd = this.program.commands.find((cmd) => cmd.name() === 'repository');
                    
                    if (repoCmd) {
                        await repoCmd.parseAsync(['node', 'script.js', 'repository']);
                        console.clear();
                        firstRun = true;
                        continue;
                    }
                } else if (action === 'sync') {
                    cache.flushAll();
                    
                    // We'll just launch the sync command directly through Commander
                    const syncCmd = this.program.commands.find((cmd) => cmd.name() === 'sync');
                    
                    if (syncCmd) {
                        // Force reset command options
                        if ((syncCmd as any)._optionValues) {
                            (syncCmd as any)._optionValues = {};
                        }
                        
                        try {
                            await syncCmd.parseAsync(['node', 'script.js', 'sync']);
                        } catch (error) {
                            this.handleError(error, 'sync command');
                            await this.pressKeyToContinue();
                        }
                    }
                    
                    // No matter what, reset the menu state
                    console.clear();
                    firstRun = true;
                    continue;
                } else {
                    cache.flushAll();
                    await this.runCommand(this.program, action, { clearConsole: true });
                    // Ensure we always refresh the menu after any command
                    console.clear();
                    firstRun = true;
                    continue;
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
