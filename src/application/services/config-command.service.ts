import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { Config } from '../../shared/config';
import { ApiResult, Result, CommandInterface } from '../../shared/types';
import { ConfigFacade } from '../facades/config.facade';

@Injectable({ scope: Scope.DEFAULT })
export class ConfigCommandService {
    constructor(
        private readonly configFacade: ConfigFacade,
        private readonly uiFacade: UiFacade,
        private readonly textFormatter: TextFormatter,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    public getConfig(): ApiResult<Readonly<Config>> {
        return this.configFacade.getConfig();
    }

    public viewConfig(): ApiResult<void> {
        try {
            const configResult = this.configFacade.getConfig();

            if (!configResult.success || !configResult.data) {
                this.uiFacade.print(chalk.yellow('Failed to retrieve configuration.'));
                return Result.failure(configResult.error || 'Unknown error retrieving configuration');
            }

            const currentConfig = configResult.data;

            if (Object.keys(currentConfig).length === 0) {
                this.uiFacade.print(chalk.yellow('The configuration is empty.'));
            } else {
                this.uiFacade.printSectionHeader('Current Configuration', '📋');

                for (const [key, value] of Object.entries(currentConfig)) {
                    const sensitiveResult = this.configFacade.isSensitiveKey(key);
                    const isSensitive = sensitiveResult.success && sensitiveResult.data;
                    this.uiFacade.print(
                        `${chalk.cyan(key.padEnd(30))} ${chalk.gray('→')} ${
                            isSensitive
                                ? chalk.magenta('********')
                                : chalk.green(typeof value === 'string' ? value : JSON.stringify(value))
                        }`
                    );
                }
                this.uiFacade.printSeparator();
            }
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error viewing configuration:', error);
            return Result.failure(
                `Error viewing configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async editConfigMenu(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const configResult = this.configFacade.getConfig();

            if (!configResult.success || !configResult.data) {
                this.uiFacade.print(chalk.yellow('Failed to retrieve configuration.'));
                return Result.failure(configResult.error || 'Unknown error retrieving configuration');
            }

            const currentConfig = configResult.data;
            const configKeys = Object.keys(currentConfig);
            this.uiFacade.clearConsole();
            this.textFormatter.printSectionHeader('Edit Configuration', '🔧');
            const options = [
                { value: 'reset_config', name: chalk.yellow('Reset configuration to defaults') },
                ...configKeys.map((k) => ({ value: k, name: k }))
            ];
            const key = await command.selectMenu<string | 'back'>('Select configuration key to edit:', options);

            if (key === 'back') return Result.success(undefined);

            if (key === 'reset_config') {
                const confirmed = await command.confirmAction(
                    'Are you sure you want to reset all configuration to default values?',
                    { default: false }
                );

                if (confirmed) return this.resetConfig();
                return Result.success(undefined);
            }

            const currentValue = currentConfig[key as keyof typeof currentConfig];
            const value = await command.getInput(`Enter new value for ${chalk.cyan(key)}:`, {
                default: currentValue ? String(currentValue) : '',
                allowCancel: true
            });

            if (value !== null) {
                const setResult = this.configFacade.setConfig(key as any, value);

                if (!setResult.success) {
                    this.uiFacade.print(chalk.red(`Failed to update configuration: ${setResult.error}`));
                    return setResult;
                }

                const sensitiveResult = this.configFacade.isSensitiveKey(key);
                const isSensitive = sensitiveResult.success && sensitiveResult.data;
                this.uiFacade.print(chalk.green(`Configuration updated: ${key} = ${isSensitive ? '********' : value}`));
                return Result.success(undefined);
            } else {
                this.uiFacade.print(chalk.yellow('Input cancelled. Configuration not updated.'));
                return Result.failure('Input cancelled');
            }
        } catch (error) {
            this.loggerService.error('Error editing configuration:', error);
            return Result.failure(
                `Error editing configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public resetConfig(): ApiResult<void> {
        try {
            const resetResult = this.configFacade.resetConfig();

            if (!resetResult.success) {
                this.loggerService.error(`Failed to reset configuration: ${resetResult.error}`);
                return resetResult;
            }

            this.uiFacade.print(chalk.green('Configuration has been reset to defaults.'));
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error resetting configuration:', error);
            return Result.failure(
                `Error resetting configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public setConfigValue(key: string, value: string): ApiResult<void> {
        try {
            const result = this.configFacade.setConfigByString(key, value);

            if (!result.success) {
                this.loggerService.error(`Failed to set configuration: ${result.error}`);
                return result;
            }

            const sensitiveResult = this.configFacade.isSensitiveKey(key);
            const isSensitive = sensitiveResult.success && sensitiveResult.data;
            this.uiFacade.print(chalk.green(`Configuration updated: ${key} = ${isSensitive ? '********' : value}`));
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error setting configuration value:', error);
            return Result.failure(
                `Error setting configuration value: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public viewConfigKey(key: string): ApiResult<void> {
        try {
            const configResult = this.configFacade.getConfig();

            if (!configResult.success || !configResult.data) {
                this.uiFacade.print(chalk.yellow('Failed to retrieve configuration.'));
                return Result.failure(configResult.error || 'Unknown error retrieving configuration');
            }

            const config = configResult.data;
            const value = config[key as keyof typeof config];

            if (value === undefined) {
                this.uiFacade.print(chalk.yellow(`Configuration key "${key}" is not set.`));
            } else {
                const sensitiveResult = this.configFacade.isSensitiveKey(key);
                const isSensitive = sensitiveResult.success && sensitiveResult.data;
                this.uiFacade.print(
                    chalk.cyan(`${key}`) +
                        chalk.gray(' → ') +
                        (isSensitive
                            ? chalk.magenta('********')
                            : chalk.green(typeof value === 'string' ? value : JSON.stringify(value)))
                );
            }
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error viewing configuration key:', error);
            return Result.failure(
                `Error viewing configuration key: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
