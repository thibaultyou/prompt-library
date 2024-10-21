import fs from 'fs-extra';

import { handleError } from './error.util';
import { readDirectory } from '../../shared/utils/file_system.util';
import { cliConfig } from '../cli.config';

export async function hasPrompts(): Promise<boolean> {
    try {
        await fs.ensureDir(cliConfig.PROMPTS_DIR);
        const promptDirs = await readDirectory(cliConfig.PROMPTS_DIR);
        return promptDirs.length > 0;
    } catch (error) {
        handleError(error, 'checking prompts directory');
        return false;
    }
}

export async function hasFragments(): Promise<boolean> {
    try {
        await fs.ensureDir(cliConfig.FRAGMENTS_DIR);
        const fragmentDirs = await readDirectory(cliConfig.FRAGMENTS_DIR);
        return fragmentDirs.length > 0;
    } catch (error) {
        handleError(error, 'checking fragments directory');
        return false;
    }
}
