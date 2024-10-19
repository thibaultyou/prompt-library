import fs from 'fs-extra';

import { readDirectory } from '../../shared/utils/file_operations';
import { cliConfig } from '../config/cli.config';

export async function hasPrompts(): Promise<boolean> {
    try {
        await fs.ensureDir(cliConfig.PROMPTS_DIR);
        const promptDirs = await readDirectory(cliConfig.PROMPTS_DIR);
        return promptDirs.length > 0;
    } catch (error) {
        console.error('Error checking prompts directory:', error);
        return false;
    }
}

export async function hasFragments(): Promise<boolean> {
    try {
        await fs.ensureDir(cliConfig.FRAGMENTS_DIR);
        const fragmentDirs = await readDirectory(cliConfig.FRAGMENTS_DIR);
        return fragmentDirs.length > 0;
    } catch (error) {
        console.error('Error checking fragments directory:', error);
        return false;
    }
}
