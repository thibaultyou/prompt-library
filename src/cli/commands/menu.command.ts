import chalk from 'chalk';
import { Command } from 'commander';

import { BaseCommand } from './base.command';
import { getConfig } from '../../shared/config';
import { hasPrompts, hasFragments } from '../utils/content.util';

type MenuAction = 'sync' | 'prompts' | 'fragments' | 'settings' | 'env' | 'back';

class MenuCommand extends BaseCommand {
    constructor(private program: Command) {
        super('menu', 'Main menu for the CLI');
    }

    async execute(): Promise<void> {
        while (true) {
            const config = getConfig();
            const [promptsExist, fragmentsExist] = await Promise.all([hasPrompts(), hasFragments()]);
            const choices: Array<{ name: string; value: MenuAction }> = [];

            if (!config.REMOTE_REPOSITORY || (!promptsExist && !fragmentsExist)) {
                choices.push({
                    name: chalk.green(chalk.bold('Sync with remote repository')),
                    value: 'sync'
                });
            }

            choices.push(
                { name: 'Browse and run prompts', value: 'prompts' },
                { name: 'Manage prompt fragments', value: 'fragments' },
                { name: 'Manage environment variables', value: 'env' },
                { name: 'Settings', value: 'settings' }
            );

            console.clear();

            const action = await this.showMenu<MenuAction>(
                `${chalk.reset(chalk.italic(chalk.cyan('Want to manage AI prompts with ease ?')))}
${chalk.bold(`${chalk.yellow('Welcome to the Prompt Library !')}
Select an action:`)}`,
                choices,
                { goBackLabel: 'Exit' }
            );
            switch (action) {
                case 'sync':
                    await this.runCommand(this.program, 'sync');
                    break;
                case 'prompts':
                    await this.runCommand(this.program, 'prompts');
                    break;
                case 'fragments':
                    await this.runCommand(this.program, 'fragments');
                    break;
                case 'env':
                    await this.runCommand(this.program, 'env');
                    break;
                case 'settings':
                    await this.runCommand(this.program, 'settings');
                    break;
                case 'back':
                    console.log(chalk.yellow('Goodbye!'));
                    return;
            }
        }
    }
}

export async function showMainMenu(program: Command): Promise<void> {
    const menuCommand = new MenuCommand(program);
    await menuCommand.execute();
}
