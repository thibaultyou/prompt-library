import { input, confirm } from '@inquirer/prompts';
import { Injectable, Scope } from '@nestjs/common';

import {
    Config,
    getConfig as getConfigUtil,
    getConfigValue as getConfigValueUtil,
    setConfig as setConfigUtil
} from '../../../shared/config';
import { DEFAULT_CONFIG, SENSITIVE_CONFIG_KEYS } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ConfigService {
    constructor() {}

    getConfig(): ApiResult<Readonly<Config>> {
        try {
            return Result.success(getConfigUtil());
        } catch (error) {
            console.error('Error getting configuration:', error);
            return Result.failure(error instanceof Error ? error.message : 'Failed to get configuration');
        }
    }

    getConfigValue<K extends keyof Config>(key: K): ApiResult<Config[K]> {
        try {
            return Result.success(getConfigValueUtil(key));
        } catch (error) {
            console.error(`Error getting config value for key ${String(key)}:`, error);
            return Result.failure(
                error instanceof Error ? error.message : `Failed to get config value for key: ${String(key)}`
            );
        }
    }

    setConfig<K extends keyof Config>(key: K, value: Config[K]): ApiResult<void> {
        try {
            setConfigUtil(key, value);
            return Result.success(undefined);
        } catch (error) {
            console.error(`Error setting config value for key ${String(key)}:`, error);
            return Result.failure(
                error instanceof Error ? error.message : `Failed to set config value for key: ${String(key)}`
            );
        }
    }

    setConfigByString(key: string, value: unknown): ApiResult<void> {
        try {
            setConfigUtil(key as keyof Config, value as any);
            return Result.success(undefined);
        } catch (error) {
            console.error(`Error setting config by string key ${key}:`, error);
            return Result.failure(
                error instanceof Error ? error.message : `Failed to set config by string key: ${key}`
            );
        }
    }

    resetConfig(): ApiResult<void> {
        try {
            Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
                this.setConfigByString(key, value);
            });
            return Result.success(undefined);
        } catch (error) {
            console.error('Error resetting configuration:', error);
            return Result.failure(error instanceof Error ? error.message : 'Failed to reset configuration to defaults');
        }
    }

    async promptForConfigValue(key: string, message: string): Promise<ApiResult<string>> {
        try {
            const value = await input({ message });
            return Result.success(value);
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.warn('Input cancelled.');
                return Result.failure('User cancelled input');
            }

            console.error(`Error prompting for config value ${key}:`, error);
            return Result.failure(error instanceof Error ? error.message : `Failed to prompt for config value ${key}`);
        }
    }

    async promptForConfirmation(message: string, defaultValue = false): Promise<ApiResult<boolean>> {
        try {
            const result = await confirm({ message, default: defaultValue });
            return Result.success(result);
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.warn('Confirmation cancelled.');
                return Result.failure('User cancelled confirmation');
            }

            console.error('Error prompting for confirmation:', error);
            return Result.failure(error instanceof Error ? error.message : 'Failed to prompt for confirmation');
        }
    }

    isSensitiveKey(key: string): ApiResult<boolean> {
        try {
            const isSensitive = SENSITIVE_CONFIG_KEYS.some((sensitiveKey: string) =>
                key.toUpperCase().includes(sensitiveKey)
            );
            return Result.success(isSensitive);
        } catch (error) {
            console.error(`Error checking sensitivity for key ${key}:`, error);
            return Result.failure(
                error instanceof Error ? error.message : `Failed to check if key is sensitive: ${key}`
            );
        }
    }
}
