import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import { SimpleGit } from 'simple-git';

import { syncPromptsWithDatabase, cleanupOrphanedData } from './database';
import { getConfig, setConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';

export interface FileChange {
    type: 'added' | 'modified' | 'deleted';
    path: string;
}

export async function getRepoUrl(
    optionUrl: string | undefined,
    promptFn: (message: string) => Promise<string>
): Promise<string> {
    const config = getConfig();
    let repoUrl = optionUrl || config.REMOTE_REPOSITORY;

    if (!repoUrl) {
        repoUrl = await promptFn('Enter the remote repository URL:');
        setConfig('REMOTE_REPOSITORY', repoUrl);
    }
    return repoUrl;
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
    logger.info('Cleaning up temporary directory...');
    await fs.remove(tempDir);
}

export async function cloneRepository(git: SimpleGit, repoUrl: string, tempDir: string): Promise<void> {
    logger.info('Fetching remote data...');
    await git.clone(repoUrl, tempDir);
}

export async function diffDirectories(localDir: string, remoteDir: string): Promise<FileChange[]> {
    const changes: FileChange[] = [];

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

export function logChanges(changes: FileChange[], title: string): void {
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

export async function syncDirectories(localDir: string, remoteDir: string, changes: FileChange[]): Promise<void> {
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

export async function performSync(
    tempDir: string,
    changes: FileChange[],
    fragmentChanges: FileChange[]
): Promise<void> {
    logger.info('Syncing prompts...');
    await syncDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'), changes);

    logger.info('Syncing fragments...');
    await syncDirectories(getConfig().FRAGMENTS_DIR, path.join(tempDir, 'fragments'), fragmentChanges);

    logger.info('Updating database...');
    await syncPromptsWithDatabase();

    logger.info('Cleaning up orphaned data...');
    await cleanupOrphanedData();

    logger.info('Removing temporary files...');
    await fs.remove(tempDir);
}
