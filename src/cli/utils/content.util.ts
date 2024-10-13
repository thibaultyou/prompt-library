import { readDirectory } from '../../shared/utils/file_operations';
import { cliConfig } from '../config/cli.config';

export async function hasPrompts(): Promise<boolean> {
    const promptDirs = await readDirectory(cliConfig.PROMPTS_DIR);
    return promptDirs.length > 0;
}

export async function hasFragments(): Promise<boolean> {
    const fragmentDirs = await readDirectory(cliConfig.FRAGMENTS_DIR);
    return fragmentDirs.length > 0;
}
