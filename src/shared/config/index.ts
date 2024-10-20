import * as fs from 'fs';

import { CommonConfig, commonConfig } from './common.config';
import { CONFIG_DIR, CONFIG_FILE, isCliEnvironment } from './config.constants';
import { AppConfig, appConfig } from '../../app/config/app.config';
import { CliConfig, cliConfig } from '../../cli/config/cli.config';

export type Config = CommonConfig & (CliConfig | AppConfig);

let loadedConfig: Config | null = null;

function loadConfig(): Config {
    const environmentConfig = isCliEnvironment ? cliConfig : appConfig;
    let config: Config = { ...commonConfig, ...environmentConfig };

    if (isCliEnvironment) {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        if (fs.existsSync(CONFIG_FILE)) {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            config = { ...config, ...fileConfig };
        }
    }
    return config;
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
    if (!isCliEnvironment) {
        throw new Error('setConfig is only available in CLI environment');
    }

    if (!loadedConfig) {
        loadedConfig = loadConfig();
    }

    loadedConfig[key] = value;

    // Update process.env to reflect the change
    if (typeof value === 'string') {
        process.env[key.toString()] = value;
    }

    // Write to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(loadedConfig, null, 2));

    // Clear the cache by reassigning loadedConfig to null
    loadedConfig = null as unknown as Config;
}

export function getConfig(): Readonly<Config> {
    if (loadedConfig === null) {
        loadedConfig = loadConfig();
    }
    return loadedConfig;
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
    if (loadedConfig === null) {
        loadedConfig = loadConfig();
    }

    if (isCliEnvironment) {
        return loadedConfig[key];
    } else {
        const envValue = process.env[key.toString()];
        return (envValue !== undefined ? envValue : loadedConfig[key]) as Config[K];
    }
}

type ConfigValue = Config[keyof Config];

export const config: Readonly<Config> = new Proxy({} as Config, {
    get(_, prop: string): ConfigValue {
        return getConfigValue(prop as keyof Config);
    }
});
