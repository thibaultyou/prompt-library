import path from 'path';

import { Inject, Injectable, Scope } from '@nestjs/common';
import simpleGit from 'simple-git';

import { IPromptSyncRepository } from '../../core/prompt/repositories/prompt-sync.repository.interface';
import { ErrorService } from '../../infrastructure/error/services/error.service';
import { FileSystemService } from '../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { getConfig, getConfigValue } from '../../shared/config';
import { BASE_DIR } from '../../shared/constants';
import { ApiResult, Result, SyncChangeItem, SyncResetResult } from '../../shared/types';
import { RepositoryFacade } from '../facades/repository.facade';
import { SyncFacade } from '../facades/sync.facade';

@Injectable({ scope: Scope.DEFAULT })
export class SyncCommandService {
    constructor(
        private readonly repositoryFacade: RepositoryFacade,
        private readonly syncFacade: SyncFacade,
        @Inject(IPromptSyncRepository)
        private readonly promptSyncRepo: IPromptSyncRepository,
        private readonly fsService: FileSystemService,
        private readonly loggerService: LoggerService,
        private readonly uiFacade: UiFacade,
        private readonly errorService: ErrorService
    ) {}

    public async executeSyncWithRemote(repoUrlInput?: string, force: boolean = false): Promise<ApiResult<void>> {
        try {
            const isSetup = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!isSetup.success || !isSetup.data) return Result.failure('Repository not set up.');

            const repoUrlResult = await this.syncFacade.getRepoUrl(repoUrlInput);

            if (!repoUrlResult.success || !repoUrlResult.data) {
                return Result.failure(repoUrlResult.error || 'Repository URL not found');
            }

            const repoUrl = repoUrlResult.data;
            const hasLocalChanges = await this.syncFacade.hasRepositoryChanges();

            if (hasLocalChanges.success && hasLocalChanges.data) {
                this.loggerService.warn('Local changes detected. Push first.');
                return Result.failure('Local changes need to be pushed first. Run `sync --push`');
            }

            const fetchResult = await this.syncFacade.fetchFromRemote(repoUrl);

            if (!fetchResult.success) return Result.failure(fetchResult.error || 'Failed to fetch.');

            const defaultBranch = getConfigValue('DEFAULT_BRANCH') || 'main';
            const remoteDiffResult = await this.syncFacade.getRemoteDiff(defaultBranch);

            if (!remoteDiffResult.success)
                return Result.failure(remoteDiffResult.error || 'Failed check remote changes.');

            if (remoteDiffResult.data === 'No changes to pull from remote') {
                this.loggerService.info('No changes detected. Up to date.');
                return Result.success(undefined);
            }

            if (remoteDiffResult.data) {
                this.loggerService.info('Remote changes detected:');
                this.loggerService.info(remoteDiffResult.data);

                if (!force) {
                    return Result.failure('Remote changes need confirmation', { diff: remoteDiffResult.data });
                }
            }

            const pullResult = await this.syncFacade.pullFromRemote(defaultBranch);

            if (!pullResult.success) return Result.failure(pullResult.error || 'Failed to pull changes.');

            await this.performDbSync();
            this.loggerService.success('Sync completed successfully!');
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error(
                `Error syncing with remote: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(`Failed sync with remote: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async pushPendingChanges(
        branchName?: string
    ): Promise<ApiResult<{ changesSummary: string; branchName: string }>> {
        try {
            const isSetup = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!isSetup.success || !isSetup.data) return Result.failure('Repository not set up.');

            const hasGitChanges = await this.syncFacade.hasRepositoryChanges();

            if (!hasGitChanges.success || !hasGitChanges.data) {
                return Result.failure('No changes to push');
            }

            const changes = await this.repositoryFacade.getLibraryRepositoryChanges();
            let changesSummary = '';

            if (changes.success && changes.data && changes.data.length > 0) {
                changesSummary = this.syncFacade.formatChanges(changes.data, 'Changes to push');
            } else {
                return Result.failure('No changes detected in content directories');
            }

            const gitConfig = getConfig();
            const defaultBranch = gitConfig.DEFAULT_BRANCH || 'main';
            const branch = branchName || defaultBranch;
            return Result.success({ changesSummary, branchName: branch });
        } catch (error) {
            this.loggerService.error(`Error preparing push: ${error instanceof Error ? error.message : String(error)}`);
            return Result.failure(`Failed prepare push: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async commitAndPushChanges(branch: string, commitMessage: string): Promise<ApiResult<boolean>> {
        try {
            const result = await this.syncFacade.commitAndPushChanges(branch, commitMessage);

            if (result.success) {
                await this.performDbSync();
                return Result.success(true);
            } else {
                return Result.failure(result.error || 'Failed to push changes');
            }
        } catch (error) {
            this.loggerService.error(
                `Error pushing changes: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(`Failed push changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async getChangesForReset(): Promise<
        ApiResult<{
            promptChanges: Array<{ type: string; path: string; originalType: string }>;
            fragmentChanges: Array<{ type: string; path: string; originalType: string }>;
        }>
    > {
        try {
            const isSetup = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!isSetup.success || !isSetup.data) return Result.failure('Repository not set up.');

            const changes = await this.repositoryFacade.getLibraryRepositoryChanges();

            if (!changes.success || !changes.data || changes.data.length === 0) {
                return Result.failure('No changes to reset');
            }

            const promptChanges: { type: string; path: string; originalType: string }[] = [];
            const fragmentChanges: { type: string; path: string; originalType: string }[] = [];

            for (const change of changes.data) {
                let resetType = '';
                let originalType = '';

                if (change.status === 'A' || change.status === '?') {
                    resetType = 'Delete';
                    originalType = 'added';
                } else if (change.status === 'D') {
                    resetType = 'Restore';
                    originalType = 'deleted';
                } else {
                    resetType = 'Restore';
                    originalType = 'modified';
                }

                if (change.path.startsWith('prompts/')) {
                    promptChanges.push({ type: resetType, path: change.path.replace('prompts/', ''), originalType });
                } else if (change.path.startsWith('fragments/')) {
                    fragmentChanges.push({
                        type: resetType,
                        path: change.path.replace('fragments/', ''),
                        originalType
                    });
                }
            }

            if (promptChanges.length === 0 && fragmentChanges.length === 0) {
                return Result.failure('No changes to reset in content directories');
            }
            return Result.success({ promptChanges, fragmentChanges });
        } catch (error) {
            this.loggerService.error(
                `Error getting changes for reset: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed get changes for reset: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async resetLocalChanges(changesToReset: SyncChangeItem[]): Promise<ApiResult<SyncResetResult>> {
        try {
            let successCount = 0;
            let failCount = 0;
            this.loggerService.info(`Resetting ${changesToReset.length} changes`);
            this.loggerService.debug(`Changes to reset: ${JSON.stringify(changesToReset)}`);
            const git = simpleGit(BASE_DIR);

            for (const change of changesToReset) {
                try {
                    let fullPath =
                        change.type === 'prompt'
                            ? path.join('prompts', change.path)
                            : path.join('fragments', change.path);

                    if (change.type === 'fragment' && !fullPath.endsWith('.md')) {
                        const parts = change.path.split('/');

                        if (parts.length === 2) fullPath = path.join('fragments', parts[0], `${parts[1]}.md`);
                        else if (!change.path.includes('/')) fullPath = path.join('fragments', change.path);
                        else fullPath = path.join('fragments', change.path);
                    } else if (change.type === 'prompt') {
                        fullPath = path.join('prompts', change.path);
                    }

                    this.loggerService.info(
                        `Resetting ${change.type}: ${fullPath} (Original change: ${change.changeType})`
                    );

                    if (change.changeType === 'added' || change.changeType === '?') {
                        try {
                            const absolutePath = path.join(BASE_DIR, fullPath);

                            if (await this.fsService.fileExists(absolutePath).then((r) => r.success && r.data)) {
                                await this.fsService.removeDirectory(absolutePath);
                                this.loggerService.info(`Successfully removed: ${fullPath}`);

                                try {
                                    await git.reset(['--', fullPath]);
                                } catch (resetErr) {
                                    /* ignore */
                                }

                                successCount++;
                            } else {
                                this.loggerService.warn(`Path not found for removal: ${fullPath}`);
                                successCount++;
                            }
                        } catch (removeError) {
                            this.loggerService.error(`Failed to remove: ${fullPath}`, removeError);
                            failCount++;
                        }
                    } else {
                        try {
                            await git.checkout(['HEAD', '--', fullPath]);
                            this.loggerService.info(`Successfully reset/restored: ${fullPath}`);
                            successCount++;
                        } catch (checkoutError) {
                            this.loggerService.error(`Failed to checkout: ${fullPath}`, checkoutError);
                            failCount++;
                        }
                    }
                } catch (changeError) {
                    this.loggerService.error(
                        `Failed to process reset for change: ${change.type} ${change.path}`,
                        changeError
                    );
                    failCount++;
                }
            }
            await this.performDbSync();
            this.loggerService.info(`Reset completed: ${successCount} succeeded, ${failCount} failed`);
            return Result.success({ successCount, failCount });
        } catch (error) {
            this.loggerService.error(
                `Error resetting local changes: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to reset local changes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async offerRemoteSync(): Promise<ApiResult<boolean>> {
        try {
            const isSetup = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!isSetup.success || !isSetup.data) return Result.failure('Repository not set up.');

            const repoInfo = await this.repositoryFacade.getRepositoryInfo();

            if (!repoInfo.success || !repoInfo.data?.url) {
                this.loggerService.warn('No remote repository configured. Cannot offer sync.');
                return Result.success(false);
            }

            const hasChanges = await this.repositoryFacade.hasLibraryRepositoryChanges();

            if (!hasChanges.success || !hasChanges.data) {
                this.loggerService.info('No local changes to sync.');
                return Result.success(false);
            }

            const doSync = await this.uiFacade.confirm(
                'You have local changes. Sync them to the remote repository now?',
                true
            );

            if (!doSync) {
                this.loggerService.info('Sync skipped by user. Use `sync --push` later.');
                return Result.success(false);
            }

            const branch = repoInfo.data.branch || getConfigValue('DEFAULT_BRANCH') || 'main';
            const commitMessage = `Sync changes via CLI [${new Date().toISOString()}]`;
            const pushResult = await this.commitAndPushChanges(branch, commitMessage);

            if (pushResult.success) {
                this.loggerService.success('Changes successfully synced to remote.');
                return Result.success(true);
            } else {
                this.loggerService.error(`Failed to sync changes: ${pushResult.error}`);
                return Result.failure(pushResult.error || 'Sync failed');
            }
        } catch (error) {
            this.errorService.handleError(error, 'offering remote sync');
            return Result.failure(
                `Failed offer remote sync: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async performDbSync(): Promise<ApiResult<void>> {
        try {
            this.loggerService.info('Syncing database with filesystem...');
            await this.promptSyncRepo.syncPromptsWithFileSystem();
            this.loggerService.info('Database synchronization complete.');
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error(
                `Error performing DB sync: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to perform DB sync: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
