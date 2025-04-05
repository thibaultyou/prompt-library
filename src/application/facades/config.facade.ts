import { Injectable, Scope } from '@nestjs/common';

import { ConfigService } from '../../infrastructure/config/services/config.service';
import { Config } from '../../shared/config';
import { ApiResult } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ConfigFacade {
    constructor(private readonly configService: ConfigService) {}

    public async promptForConfigValue(key: string, message: string): Promise<ApiResult<string>> {
        return this.configService.promptForConfigValue(key, message);
    }

    public async promptForConfirmation(message: string, defaultValue = false): Promise<ApiResult<boolean>> {
        return this.configService.promptForConfirmation(message, defaultValue);
    }

    public getConfig(): ApiResult<Readonly<Config>> {
        return this.configService.getConfig();
    }

    public getConfigValue<K extends keyof Config>(key: K): ApiResult<Config[K]> {
        return this.configService.getConfigValue(key);
    }

    public setConfig<K extends keyof Config>(key: K, value: Config[K]): ApiResult<void> {
        return this.configService.setConfig(key, value);
    }

    public resetConfig(): ApiResult<void> {
        return this.configService.resetConfig();
    }

    public setConfigByString(key: string, value: unknown): ApiResult<void> {
        return this.configService.setConfigByString(key, value);
    }

    public isSensitiveKey(key: string): ApiResult<boolean> {
        return this.configService.isSensitiveKey(key);
    }
}
