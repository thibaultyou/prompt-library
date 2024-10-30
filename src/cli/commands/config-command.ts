import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { Config, getConfig, setConfig } from '../../shared/config';

class ConfigCommand extends BaseCommand {
    constructor() {
        super('config', 'Manage CLI configuration');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                const action = await this.showMenu<'view' | 'set' | 'back'>('Select an action:', [
                    { name: 'View current configuration', value: 'view' },
                    { name: 'Set a configuration value', value: 'set' }
                ]);
                switch (action) {
                    case 'view':
                        this.viewConfig();
                        await this.pressKeyToContinue();
                        break;
                    case 'set':
                        await this.setConfigValue();
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
        console.log(chalk.cyan('Current configuration:'));

        if (Object.keys(currentConfig).length === 0) {
            console.log(chalk.yellow('The configuration is empty.'));
        } else {
            Object.entries(currentConfig).forEach(([key, value]) => {
                console.log(`${key} -->`, chalk.green(key === 'ANTHROPIC_API_KEY' ? '********' : value));
            });
        }
    }

    private async setConfigValue(): Promise<void> {
        const currentConfig = getConfig();
        const configKeys = Object.keys(currentConfig) as Array<keyof Config>;
        const key = await this.showMenu<keyof Config | 'back'>(
            'Select the configuration key:',
            configKeys.map((k) => ({ value: k, name: k }))
        );

        if (key === 'back') return;

        const value = await this.getInput(`Enter the value for ${chalk.cyan(key)}:`);
        setConfig(key, value);
        console.log(chalk.green(`Configuration updated: ${key} = ${value}`));
    }
}

export default new ConfigCommand();
