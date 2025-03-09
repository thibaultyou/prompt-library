import path from 'path';

import fs from 'fs-extra';
import simpleGit from 'simple-git';

import { BaseCommand } from './base-command';
import { getConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { cliConfig } from '../config/cli-config';
import {
    getRepoUrl,
    cleanupTempDir,
    cloneRepository,
    diffDirectories,
    logChanges,
    performSync
} from '../utils/sync-utils';

class SyncCommand extends BaseCommand {
    constructor() {
        super('sync', 'Sync prompts with the remote repository');
        this.option('-u, --url <url>', 'Set the remote repository URL')
            .option('--force', 'Force sync without confirmation')
            .action(this.execute.bind(this));
    }

    async execute(options: { url?: string; force?: boolean }): Promise<void> {
        try {
            const repoUrl = await getRepoUrl(options.url, this.getInput.bind(this));
            const git = simpleGit();
            const tempDir = path.join(cliConfig.TEMP_DIR, 'temp_repository');
            await cleanupTempDir(tempDir);
            await cloneRepository(git, repoUrl, tempDir);

            const config = getConfig();
            const prompts_dir = path.join(tempDir, 'prompts');
            const fragments_dir = path.join(tempDir, 'fragments');
            const changes = await diffDirectories(config.PROMPTS_DIR, prompts_dir);
            const fragmentChanges = await diffDirectories(config.FRAGMENTS_DIR, fragments_dir);

            if (changes.length === 0 && fragmentChanges.length === 0) {
                logger.info('No changes detected. Everything is up to date.');
                await fs.remove(tempDir);
                return;
            }

            logChanges(changes, 'Prompts');
            logChanges(fragmentChanges, 'Fragments');

            if (!options.force && !(await this.confirmSync())) {
                logger.info('Sync cancelled by user.');
                await fs.remove(tempDir);
                return;
            }

            await performSync(tempDir, changes, fragmentChanges);

            logger.info('Sync completed successfully!');
        } catch (error) {
            this.handleError(error, 'sync');
        } finally {
            await this.pressKeyToContinue();
        }
    }

    private async confirmSync(): Promise<boolean> {
        return this.confirmAction('Do you want to proceed with the sync?');
    }
}

export default new SyncCommand();
