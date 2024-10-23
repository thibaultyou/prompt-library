import * as os from 'os';
import * as path from 'path';

export const isCliEnvironment = process.env.CLI_ENV === 'cli';

export const CONFIG_DIR = isCliEnvironment
    ? path.join(os.homedir(), '.prompt-library-cli')
    : path.resolve(__dirname, '..');

export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
