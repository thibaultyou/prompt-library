import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';

import { CommandError, createCommandError } from '../commands/base-command';
import { handleError } from './errors';
import { getConfig } from '../../shared/config';
import { readDirectory } from '../../shared/utils/file-system';
import { cliConfig } from '../config/cli-config';
import logger from '../../shared/utils/logger';

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

export const flushDirectories = (): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.tryCatch(
            async () => {
                logger.info('Flushing local directories...');
                await fs.emptyDir(getConfig().PROMPTS_DIR);
                await fs.emptyDir(getConfig().FRAGMENTS_DIR);
                logger.info('Local directories flushed successfully');
            },
            (error) => createCommandError('FLUSH_ERROR', 'Failed to flush directories', error)
        )
    );
