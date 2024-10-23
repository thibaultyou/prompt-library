import * as fs from 'fs';

import { CommonConfig, commonConfig } from './common-config';
import { CONFIG_DIR, CONFIG_FILE, isCliEnvironment } from './constants';
import { appConfig, AppConfig } from '../../app/config/app-config';
import { CliConfig, cliConfig } from '../../cli/config/cli-config';

export type Config = CommonConfig & (CliConfig | AppConfig);

let loadedConfig: Config | null = null;
let lastCliEnv: string | undefined;

export function clearConfigCache(): void {
    loadedConfig = null;
    lastCliEnv = undefined;
}

function loadConfig(): Config {
    if (process.env.CLI_ENV !== lastCliEnv) {
        loadedConfig = null;
        lastCliEnv = process.env.CLI_ENV;
    }

    if (loadedConfig) {
        return JSON.parse(JSON.stringify(loadedConfig));
    }

    const environmentConfig = isCliEnvironment ? cliConfig : appConfig;
    let config = {
        ...commonConfig,
        ...environmentConfig
    } as Config;

    if (isCliEnvironment && fs.existsSync(CONFIG_FILE)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            config = { ...config, ...fileConfig };
        } catch (error) {
            console.error('Error loading config file:', error);
        }
    }

    loadedConfig = JSON.parse(JSON.stringify(config));
    return config;
}

export function getConfig(): Readonly<Config> {
    return loadConfig();
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
    if (process.env.CLI_ENV !== 'cli') {
        throw new Error('setConfig is only available in CLI environment');
    }

    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const config = loadConfig();
    const updatedConfig = { ...config, [key]: value };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));

    loadedConfig = updatedConfig;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        process.env[key] = String(value);
    }
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
    const config = loadConfig();

    if (!isCliEnvironment && process.env[key] !== undefined) {
        const envValue = process.env[key];
        const currentValue = config[key];

        if (typeof currentValue === 'number') {
            return Number(envValue) as Config[K];
        } else if (typeof currentValue === 'boolean') {
            return (envValue?.toLowerCase() === 'true') as unknown as Config[K];
        }
        return envValue as Config[K];
    }
    return config[key];
}
