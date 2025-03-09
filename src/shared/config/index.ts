import * as fs from 'fs';
// Import path

import { AppConfig, appConfig } from './app-config';
import { CliConfig, cliConfig } from './cli-config';
import { CommonConfig, commonConfig } from './common-config';
// Import constants directly
import { CONFIG_DIR, CONFIG_FILE, ENV_KEYS } from '../../shared/constants';
import { isPackageMode } from '../../shared/utils';

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

    const environmentConfig = isPackageMode() ? cliConfig : appConfig;
    const baseConfig: Config = { ...commonConfig, ...environmentConfig };
    let fileConfigData: Partial<Config> = {};

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            fileConfigData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch (error) {
            console.error(`Error loading config file (${CONFIG_FILE}):`, error);
        }
    }

    // Merge: Defaults < Environment Specific < File Config
    const mergedConfig: Config = { ...baseConfig, ...fileConfigData };
    // Apply environment variables with priority
    const finalConfig = { ...mergedConfig }; // Create a new object to modify

    for (const key in finalConfig) {
        if (Object.prototype.hasOwnProperty.call(finalConfig, key)) {
            const envValue = process.env[key as string];
            const isCritical = (ENV_KEYS as Record<string, string>)[key as keyof typeof ENV_KEYS] === key; // Check if key is in ENV_KEYS

            if (envValue !== undefined && (isCritical || finalConfig[key as keyof Config] === undefined)) {
                // Parse env value based on the type of the default value
                const defaultValue =
                    commonConfig[key as keyof CommonConfig] ?? environmentConfig[key as keyof (CliConfig | AppConfig)];
                (finalConfig as any)[key] = parseEnvValue(envValue, defaultValue);
            }
        }
    }

    loadedConfig = JSON.parse(JSON.stringify(finalConfig));
    return finalConfig;
}

export function getConfig(): Readonly<Config> {
    return loadConfig();
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const currentConfig = loadConfig(); // Load potentially cached or file config
    const updatedConfig = { ...currentConfig, [key]: value };

    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
        console.error(`Error writing config file (${CONFIG_FILE}):`, error);
        throw error;
    }

    loadedConfig = updatedConfig; // Update cache

    // Update process.env only if the key exists in ENV_KEYS for consistency
    if (
        (ENV_KEYS as Record<string, string>)[key as keyof typeof ENV_KEYS] === key &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ) {
        process.env[key as string] = String(value);
    }
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
    const config = loadConfig();
    const envValue = process.env[key as string];
    const isCritical = (ENV_KEYS as Record<string, string>)[key as keyof typeof ENV_KEYS] === key;
    const useEnvVar = envValue !== undefined && (isCritical || config[key] === undefined);

    if (useEnvVar) {
        return parseEnvValue(envValue!, config[key]);
    }
    return config[key];
}

function parseEnvValue<K extends keyof Config>(envValue: string, referenceValue: Config[K]): Config[K] {
    if (typeof referenceValue === 'number') {
        const num = Number(envValue);
        return (isNaN(num) ? referenceValue : num) as Config[K];
    } else if (typeof referenceValue === 'boolean') {
        return (envValue.toLowerCase() === 'true') as Config[K];
    } else if (Array.isArray(referenceValue)) {
        return envValue.split(',').map((s) => s.trim()) as Config[K];
    }
    return envValue as Config[K];
}

export * from './app-config';
export * from './cli-config';
export * from './common-config';
