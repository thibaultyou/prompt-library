import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { getConfig, setConfig as setConfigUtil } from '../../../shared/config';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { RepositoryService } from '../../repository/services/repository.service';

@Injectable({ scope: Scope.DEFAULT })
export class SyncService {
    constructor(
        private readonly repositoryService: RepositoryService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    public async hasRepositoryChanges(): Promise<ApiResult<boolean>> {
        return this.repositoryService.hasLibraryRepositoryChanges();
    }

    public async getRepoUrl(optionUrl?: string): Promise<ApiResult<string>> {
        try {
            const config = getConfig();
            const repoUrl = optionUrl || config.REMOTE_REPOSITORY;

            if (!repoUrl) {
                return Result.failure('No repository URL configured or provided');
            }
            return Result.success(repoUrl);
        } catch (error) {
            this.loggerService.error(
                `Error getting repository URL: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to get repository URL: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public setRepoUrl(url: string): ApiResult<boolean> {
        try {
            setConfigUtil('REMOTE_REPOSITORY', url);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error(
                `Error setting repository URL: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to set repository URL: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async fetchFromRemote(repoUrl?: string): Promise<ApiResult<void>> {
        try {
            const repoSetupResult = await this.repositoryService.isLibraryRepositorySetup();

            if (!repoSetupResult.success || !repoSetupResult.data) {
                return Result.failure('Repository not set up.');
            }

            this.loggerService.info('Fetching from remote...');
            const urlToUse = repoUrl || getConfig().REMOTE_REPOSITORY;
            await this.repositoryService.fetchFromRemote(urlToUse);
            this.loggerService.info('Successfully fetched from remote');
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error(
                `Error fetching from remote: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to fetch from remote: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public formatChanges(changes: { path: string; status: string }[], title: string): string {
        const lines: string[] = [];

        if (changes.length > 0) {
            lines.push(chalk.bold(`\n${title} Changes (${changes.length}):`));
            lines.push('─'.repeat(100));
            changes.forEach(({ path: filePath, status }) => {
                let operationType = 'modified';

                if (status === '?' || status === 'A') operationType = 'added';
                else if (status === 'D') operationType = 'deleted';

                const operationText =
                    operationType === 'added' ? 'Add' : operationType === 'modified' ? 'Modify' : 'Delete';
                const coloredOp =
                    operationType === 'added'
                        ? chalk.green(operationText.padEnd(8))
                        : operationType === 'modified'
                          ? chalk.yellow(operationText.padEnd(8))
                          : chalk.red(operationText.padEnd(8));
                lines.push(`${coloredOp} ${filePath}`);
            });
            lines.push('─'.repeat(100));
        }
        return lines.join('\n');
    }

    public async pullFromRemote(branch: string = 'main'): Promise<ApiResult<boolean>> {
        try {
            const repoSetupResult = await this.repositoryService.isLibraryRepositorySetup();

            if (!repoSetupResult.success || !repoSetupResult.data) {
                return Result.failure('Repository not set up.');
            }

            this.loggerService.info(`Attempting to pull 'origin/${branch}' into current branch...`);
            const pullResult = await this.repositoryService.pullChanges(branch);

            if (pullResult.success) {
                this.loggerService.info(`Pull successful.`);
                return Result.success(true);
            } else {
                if (pullResult.error?.includes('Already up to date')) {
                    this.loggerService.info('Repository is already up to date.');
                    return Result.success(false);
                }
                return Result.failure(pullResult.error || 'Pull failed');
            }
        } catch (error) {
            this.loggerService.error(
                `Error pulling from remote: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to pull from remote: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getRemoteDiff(branch: string = 'main'): Promise<ApiResult<string>> {
        try {
            const repoSetupResult = await this.repositoryService.isLibraryRepositorySetup();

            if (!repoSetupResult.success || !repoSetupResult.data) {
                return Result.failure('Repository not set up.');
            }

            this.loggerService.debug(`Checking diff between HEAD and origin/${branch} for content dirs...`);
            const diffResult = await this.repositoryService.getRemoteDiff(branch);

            if (!diffResult.success) {
                return Result.failure(diffResult.error || 'Failed to get remote diff');
            }

            if (!diffResult.data || diffResult.data.trim() === '') {
                this.loggerService.debug('No diff found between HEAD and remote branch for content dirs.');
                return Result.success('No changes to pull from remote');
            }

            this.loggerService.debug('Diff found between HEAD and remote branch.');
            return Result.success(diffResult.data);
        } catch (error) {
            this.loggerService.error(
                `Error getting remote diff: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(
                `Failed to get remote diff: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async commitAndPushChanges(branch: string, commitMessage: string): Promise<ApiResult<boolean>> {
        try {
            const result = await this.repositoryService.pushChangesToRemote(branch, commitMessage);
            return result;
        } catch (error) {
            this.loggerService.error(
                `Error pushing changes: ${error instanceof Error ? error.message : String(error)}`
            );
            return Result.failure(`Failed push changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
