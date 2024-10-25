import path from 'path';

import chalk from 'chalk';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import * as TE from 'fp-ts/lib/TaskEither';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import {
    CommandContext,
    CommandError,
    CommandResult,
    createCommand,
    createCommandError,
    taskEitherFromPromise
} from './base-command';
import { createInteractivePrompts, confirmAction } from './interactive';
import { getConfig, setConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { cliConfig } from '../config/cli-config';
import { syncPromptsWithDatabase, cleanupOrphanedData } from '../utils/database';

type SyncAction = 'sync' | 'back';

interface SyncCommandResult extends CommandResult {
    readonly action?: SyncAction;
}

interface FileChange {
    readonly type: 'added' | 'modified' | 'deleted';
    readonly path: string;
}

interface SyncOptions {
    readonly url?: string;
    readonly force?: boolean;
}

const prompts = createInteractivePrompts();
const logError = (error: CommandError): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.tryCatch(
            () => {
                logger.error(`Error: ${error.message}`);

                if (error.context) {
                    logger.error('Context:', error.context);
                }
                return Promise.resolve();
            },
            (e) => createCommandError('LOGGING_ERROR', 'Failed to log error', e)
        )
    );
const logProgress = (message: string): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.tryCatch(
            () => {
                logger.info(message);
                return Promise.resolve();
            },
            (e) => createCommandError('LOGGING_ERROR', 'Failed to log progress', e)
        )
    );
const getRepoUrl = (optionUrl?: string): TE.TaskEither<CommandError, string> =>
    pipe(
        O.fromNullable(optionUrl || getConfig().REMOTE_REPOSITORY),
        O.fold(
            () =>
                pipe(
                    prompts.getInput('Enter the remote repository URL:'),
                    TE.chain((url) => {
                        if (!url.trim()) {
                            return TE.left(createCommandError('CONFIG_ERROR', 'Repository URL cannot be empty'));
                        }
                        return pipe(
                            taskEitherFromPromise(
                                () => {
                                    setConfig('REMOTE_REPOSITORY', url);
                                    return Promise.resolve(url);
                                },
                                (error) => createCommandError('CONFIG_ERROR', 'Failed to set repository URL', error)
                            )
                        );
                    })
                ),
            (url) => TE.right(url)
        )
    );
const cleanup = (tempDir: string): TE.TaskEither<CommandError, void> =>
    taskEitherFromPromise(
        async () => {
            await fs.remove(tempDir);
        },
        (error) => createCommandError('CLEANUP_ERROR', 'Failed to cleanup temporary directory', error)
    );
const cleanupWithLogging = (tempDir: string): TE.TaskEither<CommandError, void> =>
    pipe(
        logProgress('Cleaning up temporary files...'),
        TE.chain(() => cleanup(tempDir)),
        TE.chainFirst(() => logProgress('Cleanup completed'))
    );
const cloneRepository = (git: SimpleGit, repoUrl: string, tempDir: string): TE.TaskEither<CommandError, void> =>
    pipe(
        logProgress('Fetching remote data...'),
        TE.chain(() =>
            taskEitherFromPromise(
                async () => {
                    await git.clone(repoUrl, tempDir);
                },
                (error) => createCommandError('CLONE_ERROR', 'Failed to clone repository', error)
            )
        )
    );
const traverseDirectory = async (
    currentLocalDir: string,
    currentRemoteDir: string,
    relativePath: string = ''
): Promise<FileChange[]> => {
    const localFiles: string[] = await fs.readdir(currentLocalDir).catch(() => []);
    const remoteFiles: string[] = await fs.readdir(currentRemoteDir).catch(() => []);
    const changes: FileChange[] = [];
    await Promise.all(
        remoteFiles.map(async (file) => {
            const localPath = path.join(currentLocalDir, file);
            const remotePath = path.join(currentRemoteDir, file);
            const currentRelativePath = path.join(relativePath, file);

            if (!localFiles.includes(file)) {
                changes.push({ type: 'added', path: currentRelativePath });
            } else {
                const remoteStats = await fs.stat(remotePath);

                if (remoteStats.isDirectory()) {
                    const subChanges = await traverseDirectory(localPath, remotePath, currentRelativePath);
                    changes.push(...subChanges);
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
        })
    );

    localFiles.forEach((file) => {
        if (!remoteFiles.includes(file)) {
            changes.push({ type: 'deleted', path: path.join(relativePath, file) });
        }
    });
    return changes;
};
const diffDirectories = (localDir: string, remoteDir: string): TE.TaskEither<CommandError, FileChange[]> =>
    taskEitherFromPromise(
        () => traverseDirectory(localDir, remoteDir),
        (error) => createCommandError('DIFF_ERROR', 'Failed to diff directories', error)
    );
const logChanges = (changes: FileChange[], title: string): void => {
    if (changes.length > 0) {
        console.log(chalk.bold(`\n${title}:`));
        changes.forEach(({ type, path: filePath }) => {
            switch (type) {
                case 'added':
                    console.log(chalk.green(`  + ${filePath}`));
                    break;
                case 'modified':
                    console.log(chalk.yellow(`  * ${filePath}`));
                    break;
                case 'deleted':
                    console.log(chalk.red(`  - ${filePath}`));
                    break;
            }
        });
    }
};
const syncDirectories = (
    localDir: string,
    remoteDir: string,
    changes: FileChange[]
): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.tryCatch(
            async () => {
                await fs.ensureDir(localDir);

                for (const change of changes) {
                    const localPath = path.join(localDir, change.path);
                    const remotePath = path.join(remoteDir, change.path);

                    try {
                        switch (change.type) {
                            case 'added':
                            case 'modified':
                                const dirPath = path.join(localDir, path.dirname(change.path));
                                await fs.ensureDir(dirPath);

                                if (await fs.pathExists(remotePath)) {
                                    await fs.copy(remotePath, localPath, { overwrite: true });
                                    await pipe(logProgress(`Synced: ${change.path}`), TE.toUnion)();
                                } else {
                                    logger.error(`Remote path does not exist: ${remotePath}`);
                                }
                                break;
                            case 'deleted':
                                await fs.remove(localPath);
                                await pipe(logProgress(`Removed: ${change.path}`), TE.toUnion)();
                                break;
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to sync ${change.path}: ${errorMessage}`);
                    }
                }
            },
            (error) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Sync error: ${errorMessage}`);
                return createCommandError('SYNC_ERROR', errorMessage);
            }
        )
    );
const performSync = (
    tempDir: string,
    changes: FileChange[],
    fragmentChanges: FileChange[]
): TE.TaskEither<CommandError, void> =>
    pipe(
        TE.Do,
        TE.chain(() => logProgress('Starting sync process...')),
        TE.chain(() => {
            if (changes.length > 0) {
                return pipe(
                    logProgress('Syncing prompts...'),
                    TE.chain(() => syncDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'), changes))
                );
            }
            return TE.right(undefined);
        }),
        TE.chain(() => {
            if (fragmentChanges.length > 0) {
                return pipe(
                    logProgress('Syncing fragments...'),
                    TE.chain(() =>
                        syncDirectories(getConfig().FRAGMENTS_DIR, path.join(tempDir, 'fragments'), fragmentChanges)
                    )
                );
            }
            return TE.right(undefined);
        }),
        TE.chain(() => logProgress('Updating database...')),
        TE.chain(() =>
            taskEitherFromPromise(
                () => syncPromptsWithDatabase(),
                (error) => createCommandError('DATABASE_SYNC_ERROR', `Failed to sync database: ${error}`)
            )
        ),
        TE.chain(() => logProgress('Cleaning up orphaned data...')),
        TE.chain(() =>
            taskEitherFromPromise(
                () => cleanupOrphanedData(),
                (error) => createCommandError('CLEANUP_ERROR', `Failed to cleanup orphaned data: ${error}`)
            )
        ),
        TE.chain(() => cleanupWithLogging(tempDir)),
        TE.chain(() => logProgress('Sync completed successfully!')),
        TE.orElse((error) =>
            pipe(
                logError(error),
                TE.chain(() => cleanupWithLogging(tempDir)),
                TE.chain(() => TE.left(error))
            )
        )
    );

const executeSyncCommand = (ctx: CommandContext): TE.TaskEither<CommandError, SyncCommandResult> => {
    const options = ctx.options as SyncOptions;
    const tempDir = path.join(cliConfig.TEMP_DIR, 'temp_repository');
    const git = simpleGit();
    const createResult = (action: SyncAction): SyncCommandResult => ({
        completed: true,
        action
    });

    return pipe(
        TE.Do,
        TE.bind('repoUrl', () => getRepoUrl(options.url)),
        TE.chain((result) => {
            logger.info(`Using repository URL: ${result.repoUrl}`);
            return pipe(
                cleanup(tempDir),
                TE.chain(() => cloneRepository(git, result.repoUrl, tempDir))
            );
        }),
        TE.bind('changes', () => diffDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'))),
        TE.bind('fragmentChanges', () => diffDirectories(getConfig().FRAGMENTS_DIR, path.join(tempDir, 'fragments'))),
        TE.chain(({ changes, fragmentChanges }) => {
            // After flushing, we should always have changes to sync
            logChanges(changes, 'Prompts');
            logChanges(fragmentChanges, 'Fragments');

            if (options.force) {
                return pipe(
                    performSync(tempDir, changes, fragmentChanges),
                    TE.map(() => createResult('sync'))
                );
            }

            return pipe(
                confirmAction('Do you want to proceed with the sync?'),
                TE.chain((confirmed) =>
                    confirmed
                        ? pipe(
                              performSync(tempDir, changes, fragmentChanges),
                              TE.map(() => createResult('sync'))
                          )
                        : pipe(
                              cleanup(tempDir),
                              TE.map(() => createResult('back'))
                          )
                )
            );
        }),
        TE.orElse((error) =>
            pipe(
                logError(error),
                TE.chain(() => cleanup(tempDir)),
                TE.chain(() => TE.left(error))
            )
        )
    );
};

export const syncCommand = createCommand('sync', 'Sync prompts with the remote repository', executeSyncCommand);
