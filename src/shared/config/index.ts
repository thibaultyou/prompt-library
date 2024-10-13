import * as fs from 'fs';

import { commonConfig, CommonConfig } from './common.config';
import { CONFIG_DIR, CONFIG_FILE, isCliEnvironment } from './config.constants';
import { AppConfig, appConfig } from '../../app/config/app.config';
import { CliConfig, cliConfig } from '../../cli/config/cli.config';

export type Config = CommonConfig & (CliConfig | AppConfig);

function loadConfig(): Config {
    const environmentConfig = isCliEnvironment ? cliConfig : appConfig;
    let config: Config = { ...commonConfig, ...environmentConfig };

    if (isCliEnvironment) {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        } else {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            config = { ...config, ...fileConfig };
        }
    }
    return config;
}

const loadedConfig: Config = loadConfig();

export function getConfig(): Readonly<Config> {
    return loadedConfig;
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
    if (isCliEnvironment) {
        loadedConfig[key] = value;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(loadedConfig, null, 2));
    } else {
        throw new Error('setConfig is only available in CLI environment');
    }
}

export const config: Readonly<Config> = loadedConfig;
