import * as path from 'path';

import { CONFIG_DIR } from '../shared/config/config.constants';

export interface CliConfig {
    PROMPTS_DIR: string;
    FRAGMENTS_DIR: string;
    DB_PATH: string;
    TEMP_DIR: string;
    MENU_PAGE_SIZE: number;
}

export const cliConfig: CliConfig = {
    PROMPTS_DIR: path.join(CONFIG_DIR, 'prompts'),
    FRAGMENTS_DIR: path.join(CONFIG_DIR, 'fragments'),
    DB_PATH: path.join(CONFIG_DIR, 'prompts.sqlite'),
    TEMP_DIR: path.join(CONFIG_DIR, 'temp'),
    MENU_PAGE_SIZE: process.env.MENU_PAGE_SIZE ? parseInt(process.env.MENU_PAGE_SIZE, 10) : 20
};
