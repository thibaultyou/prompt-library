import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { Config, getConfig, setConfig } from '../../shared/config';
import flushCommand from './flush-command';
import { formatMenuItem, getInput, printSectionHeader } from '../utils/ui-components';

class ConfigCommand extends BaseCommand {
    constructor() {
        super('config', 'Manage CLI configuration');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                console.clear();
                printSectionHeader('Configure CLI', '🔧');
                const action = await this.showMenu<'view' | 'set' | 'flush' | 'back'>('Use ↑↓ to select an action:', [
                    { name: 'View current configuration', value: 'view' },
                    { name: 'Set a configuration value', value: 'set' },
                    { name: formatMenuItem('Flush and reset data', 'flush', 'danger').name, value: 'flush' }
                ],
            {
                clearConsole: false
            });
                switch (action) {
                    case 'view':
                        this.viewConfig();
                        await this.pressKeyToContinue();
                        break;
                    case 'set':
                        await this.setConfigValue();
                        break;
                    case 'flush':
                        await flushCommand.execute();
                        break;
                    case 'back':
                        return;
                }
            } catch (error) {
                this.handleError(error, 'config command');
                await this.pressKeyToContinue();
            }
        }
    }

    private viewConfig(): void {
        const currentConfig = getConfig();
        if (Object.keys(currentConfig).length === 0) {
            console.log(chalk.yellow('The configuration is empty.'));
        } else {
            Object.entries(currentConfig).forEach(([key, value]) => {
                const isSensitive =
                    key.includes('API_KEY') || key.includes('SECRET') || key.includes('TOKEN') || /key/i.test(key);
                console.log(`${key} -->`, chalk.green(isSensitive ? '********' : value));
            });
        }
    }

    private async setConfigValue(): Promise<void> {
        const currentConfig = getConfig();
        const configKeys = Object.keys(currentConfig) as Array<keyof Config>;
        console.clear();
        printSectionHeader('Edit Configuration', '🔧');
        const key = await this.showMenu<keyof Config | 'back'>(
            'Use ↑↓ to select the configuration key:',
            configKeys.map((k) => ({ value: k, name: k })),
            {
                clearConsole: false
            }
        );

        if (key === 'back') return;

        const value = await getInput(`Enter the value for ${chalk.cyan(key)}:`, undefined, true);
        if (value !== null) {
            setConfig(key, value);
        } else {
            console.log(chalk.red('Invalid value. Configuration not updated.'));
        }
        console.log(chalk.green(`Configuration updated: ${key} = ${value}`));
    }
}

export default new ConfigCommand();
