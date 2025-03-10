import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import {
    syncPromptsWithDatabase,
    cleanupOrphanedData,
    storePendingChange,
    getPendingChangesFromDb,
    clearPendingChangesFromDb,
    hasPendingChangesInDb,
    runAsync,
    PendingChange
} from './database';
import {
    getLibraryRepositoryChanges,
    isLibraryRepositorySetup,
    LIBRARY_FRAGMENTS_DIR,
    LIBRARY_PROMPTS_DIR,
    stageAllChanges
} from './library-repository';
import { getConfig, setConfig } from '../../shared/config';
import { fileExists } from '../../shared/utils/file-system';
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
        console.log(chalk.bold(`\n${title} Changes (${changes.length}):`));
        console.log('─'.repeat(100));

        changes.forEach(({ type, path }) => {
            const operationText = type === 'added' ? 'Add' : type === 'modified' ? 'Modify' : 'Delete';
            const coloredOp =
                type === 'added'
                    ? chalk.green(operationText.padEnd(8))
                    : type === 'modified'
                      ? chalk.yellow(operationText.padEnd(8))
                      : chalk.red(operationText.padEnd(8));
            console.log(`${coloredOp} ${path}`);
        });

        console.log('─'.repeat(100));
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
    if (!(await isLibraryRepositorySetup())) {
        throw new Error('Prompt library repository is not set up');
    }

    logger.info('Syncing prompts to library repository...');
    await syncDirectories(LIBRARY_PROMPTS_DIR, path.join(tempDir, 'prompts'), changes);

    logger.info('Syncing fragments to library repository...');
    await syncDirectories(LIBRARY_FRAGMENTS_DIR, path.join(tempDir, 'fragments'), fragmentChanges);

    const config = getConfig();
    const cliPromptsDir = config.PROMPTS_DIR;
    const cliFragmentsDir = config.FRAGMENTS_DIR;
    logger.info('Syncing prompts to CLI directory...');

    if (changes.length > 0) {
        for (const change of changes) {
            const srcPath = path.join(LIBRARY_PROMPTS_DIR, change.path);
            const destPath = path.join(cliPromptsDir, change.path);

            if (change.type === 'deleted') {
                await fs.remove(destPath);
            } else {
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(srcPath, destPath, { overwrite: true });
            }
        }
    }

    logger.info('Syncing fragments to CLI directory...');

    if (fragmentChanges.length > 0) {
        for (const change of fragmentChanges) {
            const srcPath = path.join(LIBRARY_FRAGMENTS_DIR, change.path);
            const destPath = path.join(cliFragmentsDir, change.path);

            if (change.type === 'deleted') {
                await fs.remove(destPath);
            } else {
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(srcPath, destPath, { overwrite: true });
            }
        }
    }

    const staged = await stageAllChanges();

    if (staged) {
        logger.info('Staged changes in git repository');
    }

    logger.info('Updating database...');
    await syncPromptsWithDatabase();

    logger.info('Cleaning up orphaned data...');
    await cleanupOrphanedData();

    logger.info('Removing temporary files...');
    await fs.remove(tempDir);
}

export async function createBranchAndPushChanges(branchName: string): Promise<void> {
    try {
        const git: SimpleGit = simpleGit();

        if (!(await isGitRepository())) {
            throw new Error('Not a git repository');
        }

        await git.checkoutLocalBranch(branchName);

        await git.add('.');

        await git.commit('Add new prompt via CLI');

        const remotes = await git.getRemotes();

        if (remotes.length === 0) {
            throw new Error('No remote repository configured');
        }

        const remoteName = remotes[0].name;
        await git.push(remoteName, branchName, ['--set-upstream']);

        logger.info(`Changes pushed to remote branch: ${branchName}`);
    } catch (error) {
        logger.error('Failed to push changes to remote:', error);
        throw error;
    }
}

async function isGitRepository(): Promise<boolean> {
    try {
        const git: SimpleGit = simpleGit();
        await git.revparse(['--is-inside-work-tree']);
        return true;
    } catch {
        return false;
    }
}

let pendingChangesCache: PendingChange[] | null = null;

export async function trackPromptChange(
    directory: string,
    type: 'add' | 'modify' | 'delete',
    title?: string
): Promise<void> {
    if (pendingChangesCache === null) {
        pendingChangesCache = await getPendingChangesFromDb();
    }

    if (directory.startsWith('fragments/') && !directory.includes('.md')) {
        const existingIndex = pendingChangesCache.findIndex((c) => c.directory === directory);

        if (existingIndex >= 0) {
            const existingId = pendingChangesCache[existingIndex].id;

            if (existingId) {
                await runAsync('DELETE FROM pending_changes WHERE id = ?', [existingId]);
            }

            pendingChangesCache.splice(existingIndex, 1);
        }
    }

    const change: Omit<PendingChange, 'id'> = {
        directory,
        change_type: type,
        title: title || '',
        timestamp: Date.now()
    };
    await storePendingChange(change);
    pendingChangesCache = null;

    try {
        if (await isGitRepository()) {
            const git: SimpleGit = simpleGit();

            if (type === 'add' || type === 'modify') {
                const config = getConfig();
                const promptDir = path.join(config.PROMPTS_DIR, directory);

                if (await fileExists(promptDir)) {
                    try {
                        await git.add([path.join('prompts', directory)]);
                        logger.info(`Added ${directory} to git staging`);
                    } catch (gitAddError) {
                        logger.debug(`Error adding ${directory} to git staging:`, gitAddError);
                    }
                }
            }
        }
    } catch (gitError) {
        logger.debug('Failed to add files to git staging:', gitError);
    }

    logger.info(`Tracked change to prompt: ${title || directory} (${type})`);
}

export async function getPendingChanges(): Promise<PendingChange[]> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            if (await isGitRepository()) {
                const git: SimpleGit = simpleGit();
                let allChanges: PendingChange[] = [];

                try {
                    const untrackedOutput = await git.raw([
                        'ls-files',
                        '--others',
                        '--exclude-standard',
                        'prompts/',
                        'fragments/'
                    ]);

                    if (untrackedOutput && untrackedOutput.trim().length > 0) {
                        const untrackedFiles = untrackedOutput.trim().split('\n');
                        const untrackedChanges = untrackedFiles.map((filePath) => {
                            const isPrompt = filePath.startsWith('prompts/');
                            let directory = '';
                            const parts = filePath.split('/');

                            if (parts.length >= 2) {
                                directory = parts[1];
                            }
                            return {
                                directory: directory,
                                change_type: 'add' as 'add' | 'modify' | 'delete',
                                title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory} (new)`,
                                timestamp: Date.now()
                            };
                        });
                        allChanges = [...allChanges, ...untrackedChanges];
                    }
                } catch (err) {
                    logger.debug('Error checking untracked files:', err);
                }

                const status = await git.status();
                const relevantChanges = status.files.filter(
                    (file) => file.path.startsWith('prompts/') || file.path.startsWith('fragments/')
                );

                if (relevantChanges.length > 0) {
                    const trackedChanges: PendingChange[] = relevantChanges.map((file) => {
                        const isPrompt = file.path.startsWith('prompts/');
                        let directory = '';
                        const parts = file.path.split('/');

                        if (parts.length >= 2) {
                            directory = parts[1];
                        }

                        let changeType: 'add' | 'modify' | 'delete';

                        if (file.working_dir === 'A' || file.index === 'A') {
                            changeType = 'add';
                        } else if (file.working_dir === 'D' || file.index === 'D') {
                            changeType = 'delete';
                        } else {
                            changeType = 'modify';
                        }
                        return {
                            directory: directory,
                            change_type: changeType,
                            title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory}`,
                            timestamp: Date.now()
                        };
                    });
                    allChanges = [...allChanges, ...trackedChanges];
                }

                const seen = new Set<string>();
                const uniqueChanges = allChanges.filter((change) => {
                    const key = change.directory;

                    if (seen.has(key)) return false;

                    seen.add(key);
                    return true;
                });
                return uniqueChanges;
            }

            if (pendingChangesCache === null) {
                pendingChangesCache = await getPendingChangesFromDb();
            }
            return pendingChangesCache;
        }

        const config = getConfig();
        const cliPromptsDir = config.PROMPTS_DIR;
        const cliFragmentsDir = config.FRAGMENTS_DIR;
        const allChanges: PendingChange[] = [];
        const promptChanges = await diffDirectories(LIBRARY_PROMPTS_DIR, cliPromptsDir);

        for (const change of promptChanges) {
            const pathParts = change.path.split(path.sep);
            let directory = pathParts[0];

            if (pathParts.length > 1) {
                directory = pathParts[0];
            }

            allChanges.push({
                directory,
                change_type: change.type === 'added' ? 'delete' : change.type === 'modified' ? 'modify' : 'add',
                title: `Prompt: ${directory}`,
                timestamp: Date.now()
            });
        }

        const fragmentChanges = await diffDirectories(LIBRARY_FRAGMENTS_DIR, cliFragmentsDir);

        for (const change of fragmentChanges) {
            const pathParts = change.path.split(path.sep);
            let category = '';
            let name = '';

            if (pathParts.length >= 2) {
                category = pathParts[0];
                name = pathParts[1].replace(/\.md$/, '');
            } else if (pathParts.length === 1) {
                name = pathParts[0].replace(/\.md$/, '');
            }

            allChanges.push({
                directory: `${category}/${name}`,
                change_type: change.type === 'added' ? 'delete' : change.type === 'modified' ? 'modify' : 'add',
                title: `Fragment: ${category}/${name}`,
                timestamp: Date.now()
            });
        }

        const seen = new Set<string>();
        const uniqueChanges = allChanges.filter((change) => {
            const key = change.directory;

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
        });
        return uniqueChanges;
    } catch (error) {
        logger.warn('Error comparing directories, falling back to git status:', error);

        try {
            const repoChanges = await getLibraryRepositoryChanges();
            return repoChanges.map((change) => {
                const isPrompt = change.path.startsWith('prompts/');
                let directory = '';
                const parts = change.path.split('/');

                if (parts.length >= 2) {
                    directory = parts[1];
                }

                let changeType: 'add' | 'modify' | 'delete';

                if (change.status === '?' || change.status === 'A') {
                    changeType = 'add';
                } else if (change.status === 'D') {
                    changeType = 'delete';
                } else {
                    changeType = 'modify';
                }
                return {
                    directory: directory,
                    change_type: changeType,
                    title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory}`,
                    timestamp: Date.now()
                };
            });
        } catch (gitError) {
            logger.warn('Error getting changes from git, falling back to database:', gitError);

            if (pendingChangesCache === null) {
                pendingChangesCache = await getPendingChangesFromDb();
            }
            return pendingChangesCache;
        }
    }
}

export async function hasPendingChanges(): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            if (await isGitRepository()) {
                const git: SimpleGit = simpleGit();
                const status = await git.status();
                const hasPromptChanges = status.files.some(
                    (file) => file.path.startsWith('prompts/') || file.path.startsWith('fragments/')
                );
                return hasPromptChanges;
            }
            return await hasPendingChangesInDb();
        }

        const config = getConfig();
        const cliPromptsDir = config.PROMPTS_DIR;
        const cliFragmentsDir = config.FRAGMENTS_DIR;

        try {
            const [promptsDirExists, fragmentsDirExists] = await Promise.all([
                fs.pathExists(cliPromptsDir),
                fs.pathExists(cliFragmentsDir)
            ]);

            if (!promptsDirExists && !fragmentsDirExists) {
                return false;
            }

            if (promptsDirExists) {
                const promptChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);

                if (promptChanges.length > 0) {
                    const significantChanges = promptChanges.filter(
                        (change) => change.type === 'deleted' || change.type === 'modified'
                    );

                    if (significantChanges.length > 0) {
                        return true;
                    }
                }
            }

            if (fragmentsDirExists) {
                const fragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);

                if (fragmentChanges.length > 0) {
                    const significantChanges = fragmentChanges.filter(
                        (change) => change.type === 'deleted' || change.type === 'modified'
                    );

                    if (significantChanges.length > 0) {
                        return true;
                    }
                }
            }
            return false;
        } catch (diffError) {
            logger.warn('Error comparing directories, falling back to git status:', diffError);
            return await hasPendingChangesInDb();
        }
    } catch (error) {
        logger.warn('Error checking for pending changes, falling back to database:', error);
        return await hasPendingChangesInDb();
    }
}

export async function clearPendingChanges(): Promise<void> {
    await clearPendingChangesFromDb();
    pendingChangesCache = null;
    logger.info('Cleared all pending changes');
}
