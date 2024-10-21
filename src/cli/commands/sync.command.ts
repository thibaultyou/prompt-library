import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import { BaseCommand } from './base.command';
import { getConfig, setConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { cliConfig } from '../config/cli.config';
import { syncPromptsWithDatabase, cleanupOrphanedData } from '../utils/database.util';

class SyncCommand extends BaseCommand {
    constructor() {
        super('sync', 'Sync prompts with the remote repository');
        this.option('-u, --url <url>', 'Set the remote repository URL')
            .option('--force', 'Force sync without confirmation')
            .action(this.execute.bind(this));
    }

    async execute(options: { url?: string; force?: boolean }): Promise<void> {
        try {
            const repoUrl = await this.getRepoUrl(options.url);
            const git: SimpleGit = simpleGit();
            const tempDir = path.join(cliConfig.TEMP_DIR, 'temp_repository');
            await this.cleanupTempDir(tempDir);
            await this.cloneRepository(git, repoUrl, tempDir);

            const changes = await this.diffDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'));
            const fragmentChanges = await this.diffDirectories(
                getConfig().FRAGMENTS_DIR,
                path.join(tempDir, 'fragments')
            );

            if (changes.length === 0 && fragmentChanges.length === 0) {
                logger.info('No changes detected. Everything is up to date.');
                await fs.remove(tempDir);
                return;
            }

            this.logChanges(changes, 'Prompts');
            this.logChanges(fragmentChanges, 'Fragments');

            if (!options.force && !(await this.confirmSync())) {
                logger.info('Sync cancelled by user.');
                await fs.remove(tempDir);
                return;
            }

            await this.performSync(tempDir, changes, fragmentChanges);

            logger.info('Sync completed successfully!');
        } catch (error) {
            this.handleError(error, 'sync');
        } finally {
            await this.pressKeyToContinue();
        }
    }

    private async getRepoUrl(optionUrl?: string): Promise<string> {
        const config = getConfig();
        let repoUrl = optionUrl || config.REMOTE_REPOSITORY;

        if (!repoUrl) {
            repoUrl = await this.getInput('Enter the remote repository URL:');
            setConfig('REMOTE_REPOSITORY', repoUrl);
        }
        return repoUrl;
    }

    private async cleanupTempDir(tempDir: string): Promise<void> {
        logger.info('Cleaning up temporary directory...');
        await fs.remove(tempDir);
    }

    private async cloneRepository(git: SimpleGit, repoUrl: string, tempDir: string): Promise<void> {
        logger.info('Fetching remote data...');
        await git.clone(repoUrl, tempDir);
    }

    private async diffDirectories(localDir: string, remoteDir: string): Promise<Array<{ type: string; path: string }>> {
        const changes: Array<{ type: string; path: string }> = [];

        async function traverseDirectory(
            currentLocalDir: string,
            currentRemoteDir: string,
            relativePath: string = ''
        ): Promise<void> {
            const localFiles: string[] = await fs.readdir(currentLocalDir).catch(() => []);
            const remoteFiles: string[] = await fs.readdir(currentRemoteDir).catch(() => []);

            for (const file of remoteFiles) {
                const localPath = path.join(currentLocalDir, file);
                const remotePath = path.join(currentRemoteDir, file);
                const currentRelativePath = path.join(relativePath, file);

                if (!localFiles.includes(file)) {
                    changes.push({ type: 'added', path: currentRelativePath });
                } else {
                    const remoteStats = await fs.stat(remotePath);

                    if (remoteStats.isDirectory()) {
                        await traverseDirectory(localPath, remotePath, currentRelativePath);
                    } else {
                        const [localContent, remoteContent] = await Promise.all([
                            fs.readFile(localPath, 'utf-8').catch(() => ''),
                            fs.readFile(remotePath, 'utf-8').catch(() => '')
                        ]);

                        if (localContent !== remoteContent) {
                            changes.push({ type: 'modified', path: currentRelativePath });
                        }
                    }
                }
            }

            for (const file of localFiles) {
                if (!remoteFiles.includes(file)) {
                    changes.push({ type: 'deleted', path: path.join(relativePath, file) });
                }
            }
        }

        await traverseDirectory(localDir, remoteDir);
        return changes;
    }

    private logChanges(changes: Array<{ type: string; path: string }>, title: string): void {
        if (changes.length > 0) {
            console.log(chalk.bold(`\n${title}:`));
            changes.forEach(({ type, path }) => {
                switch (type) {
                    case 'added':
                        console.log(chalk.green(`  + ${path}`));
                        break;
                    case 'modified':
                        console.log(chalk.yellow(`  * ${path}`));
                        break;
                    case 'deleted':
                        console.log(chalk.red(`  - ${path}`));
                        break;
                }
            });
        }
    }

    private async confirmSync(): Promise<boolean> {
        return this.confirmAction('Do you want to proceed with the sync?');
    }

    private async performSync(
        tempDir: string,
        changes: Array<{ type: string; path: string }>,
        fragmentChanges: Array<{ type: string; path: string }>
    ): Promise<void> {
        logger.info('Syncing prompts...');
        await this.syncDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'), changes);

        logger.info('Syncing fragments...');
        await this.syncDirectories(getConfig().FRAGMENTS_DIR, path.join(tempDir, 'fragments'), fragmentChanges);

        logger.info('Updating database...');
        await syncPromptsWithDatabase();

        logger.info('Cleaning up orphaned data...');
        await cleanupOrphanedData();

        logger.info('Removing temporary files...');
        await fs.remove(tempDir);
    }

    private async syncDirectories(
        localDir: string,
        remoteDir: string,
        changes: Array<{ type: string; path: string }>
    ): Promise<void> {
        for (const { type, path: filePath } of changes) {
            const localPath = path.join(localDir, filePath);
            const remotePath = path.join(remoteDir, filePath);
            switch (type) {
                case 'added':
                case 'modified':
                    await fs.ensureDir(path.dirname(localPath));
                    await fs.copy(remotePath, localPath, { overwrite: true });
                    break;
                case 'deleted':
                    await fs.remove(localPath);
                    break;
            }
        }
    }
}

export default new SyncCommand();
