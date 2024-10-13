import chalk from 'chalk';

import { BaseCommand } from './base.command';
import { Config, getConfig, setConfig } from '../../shared/config';

type ConfigMenuAction = 'view' | 'set' | 'back';

class ConfigCommand extends BaseCommand {
    constructor() {
        super('config', 'Manage CLI configuration');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        try {
            while (true) {
                const action = await this.showMenu<ConfigMenuAction>('Select an action:', [
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
            }
        } catch (error) {
            this.handleError(error, 'config command');
        }
    }

    viewConfig(): void {
        try {
            const currentConfig = getConfig();
            console.log(chalk.cyan('Current configuration:'));

            if (Object.keys(currentConfig).length === 0) {
                console.log(chalk.yellow('The configuration is empty.'));
            } else {
                Object.entries(currentConfig).forEach(([key, value]) => {
                    if (key === 'ANTHROPIC_API_KEY') {
                        console.log(chalk.green(`${key}:`), chalk.yellow('********'));
                    } else {
                        console.log(chalk.green(`${key}:`), chalk.yellow(value));
                    }
                });
            }
        } catch (error) {
            this.handleError(error, 'viewing configuration');
        }
    }

    async setConfigValue(): Promise<void> {
        try {
            const currentConfig = getConfig();
            const configKeys = Object.keys(currentConfig) as Array<keyof Config>;
            const key = await this.showMenu<keyof Config>(
                'Select the configuration key:',
                configKeys.map((k) => ({ value: k, name: k }))
            );

            if (key.toString() === 'back') {
                return;
            }

            const value = await this.getInput(`Enter the value for ${chalk.cyan(key)}:`);
            setConfig(key, value);
            console.log(chalk.green(`Configuration updated: ${key} = ${value}`));
        } catch (error) {
            this.handleError(error, 'updating configuration');
        }
    }
}

export default new ConfigCommand();
