import chalk from 'chalk';
import { Command } from 'commander';

import { BaseCommand } from './base-command';
import { getConfigValue } from '../../shared/config';
import { getRecentExecutions } from '../utils/database';
import { handleError } from '../utils/errors';
import { hasFragments, hasPrompts } from '../utils/file-system';
import { printSectionHeader, warningMessage } from '../utils/ui-components';

type MenuAction =
    | 'sync'
    | 'prompts'
    | 'fragments'
    | 'settings'
    | 'env'
    | 'model'
    | 'back'
    | 'last_prompt'
    | 'search_prompts'
    | 'favorites'
    | 'header'
    | 'spacer'
    | 'space'
    | 'quick_actions_header'
    | 'menu_header'
    | 'config_header'
    | 'repo_header';

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
                const configModule = await import('../../shared/config');
                const { getConfig } = configModule;
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
                console.log(chalk.bold(chalk.cyan(`🧠 Prompt Library CLI`)));
                console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProvider)} / ${chalk.cyan(modelName)}`);

                let recentPrompts: any[] = [];

                try {
                    recentPrompts = await getRecentExecutions(3);
                } catch {
                    // Silently handle errors when retrieving recent executions
                }

                if (recentPrompts && recentPrompts.length > 0) {
                    console.log('');
                    console.log(chalk.bold.bgGreen.white(' ✨ QUICK ACTIONS '));

                    if (recentPrompts.length > 0) {
                        const lastPrompt = recentPrompts[0];
                        choices.push({
                            name: `Run last prompt: ${chalk.italic(lastPrompt.title || 'Unknown')}`,
                            value: 'last_prompt',
                            description: lastPrompt.id
                        });
                    }

                    choices.push({
                        name: 'Search prompts by keyword',
                        value: 'search_prompts'
                    });

                    choices.push({ name: '─'.repeat(50), value: 'back', type: 'separator' });
                }

                console.log('');
                console.log(chalk.bold.bgBlue.white(' 📚 MAIN MENU '));

                choices.push(
                    { name: chalk.bold('Browse and run prompts'), value: 'prompts' },
                    { name: 'Manage prompt fragments', value: 'fragments' }
                );

                console.log('');
                console.log(chalk.bold.bgBlue.white(' ⚙️ CONFIGURATION '));

                choices.push(
                    { name: 'Configure AI model settings', value: 'model' },
                    { name: 'Manage environment variables', value: 'env' },
                    { name: 'Settings', value: 'settings' }
                );

                console.log('');
                console.log(chalk.bold.bgYellow.black(' 🔄 REPOSITORY '));

                choices.push({ name: 'Sync with remote repository', value: 'sync' });

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
