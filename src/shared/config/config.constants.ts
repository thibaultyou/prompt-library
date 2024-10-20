import * as os from 'os';
import * as path from 'path';

import { commonConfig } from './common.config';

export const isCliEnvironment = commonConfig.CLI_ENV === 'cli';

export const CONFIG_DIR = isCliEnvironment
    ? path.join(os.homedir(), '.prompt-library-cli')
    : path.resolve(__dirname, '..');

export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
