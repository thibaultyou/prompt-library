import chalk from 'chalk';
import { Command } from 'commander';

import { BaseCommand } from './base-command';
import { handleError } from '../utils/errors';
import { hasFragments, hasPrompts } from '../utils/file-system';

type MenuAction = 'sync' | 'prompts' | 'fragments' | 'settings' | 'env' | 'model' | 'back';

class MenuCommand extends BaseCommand {
    constructor(private program: Command) {
        super('menu', 'Main menu for the CLI');
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                // Use dynamic import to avoid circular dependencies in ts-node
                const configModule = await import('../../shared/config');
                const { getConfig } = configModule;
                const config = getConfig();
                const [promptsExist, fragmentsExist] = await Promise.all([hasPrompts(), hasFragments()]);
                const choices: Array<{ name: string; value: MenuAction }> = [];

                if (!config.REMOTE_REPOSITORY || (!promptsExist && !fragmentsExist)) {
                    choices.push({
                        name: chalk.bold(chalk.green('Sync with remote repository')),
                        value: 'sync'
                    });
                }

                choices.push(
                    { name: chalk.bold(chalk.green('Browse and run prompts')), value: 'prompts' },
                    { name: 'Manage prompt fragments', value: 'fragments' },
                    { name: 'Configure AI model settings', value: 'model' },
                    { name: 'Manage environment variables', value: 'env' },
                    { name: 'Settings', value: 'settings' }
                );

                console.clear();

                const action = await this.showMenu<MenuAction>(
                    chalk.bold(`${chalk.cyan('Welcome to the Prompt Library !')}
Select an action:`),
                    choices,
                    { goBackLabel: 'Exit' }
                );

                if (action === 'back') {
                    console.log(chalk.yellow('Goodbye!'));
                    return;
                }

                await this.runCommand(this.program, action);
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
