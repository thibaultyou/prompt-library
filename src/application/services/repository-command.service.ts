import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { BASE_DIR, REPOSITORY_UI } from '../../shared/constants';
import { ApiResult, CommandInterface, Result } from '../../shared/types';
import { ConfigFacade } from '../facades/config.facade';
import { RepositoryFacade } from '../facades/repository.facade';

@Injectable({ scope: Scope.DEFAULT })
export class RepositoryCommandService {
    constructor(
        private readonly repositoryFacade: RepositoryFacade,
        private readonly configFacade: ConfigFacade,
        private readonly uiFacade: UiFacade,
        private readonly textFormatter: TextFormatter,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    public async showRepositoryInfo(): Promise<ApiResult<void>> {
        try {
            const infoResult = await this.repositoryFacade.getRepositoryInfo();

            if (!infoResult.success) throw new Error(infoResult.error || 'Failed get repo info');

            const configResult = this.configFacade.getConfig();

            if (!configResult.success || !configResult.data) throw new Error(configResult.error || 'Failed get config');

            const repoUrl = configResult.data.REMOTE_REPOSITORY || 'Not configured';
            const countResult = await this.repositoryFacade.countPendingChanges();
            const pendingChanges = countResult.success && countResult.data !== undefined ? countResult.data : 0;
            console.log(chalk.cyan('Local Directory: ') + chalk.white(BASE_DIR));
            console.log(chalk.cyan('Remote URL: ') + chalk.white(repoUrl));

            if (infoResult.data?.branch)
                console.log(chalk.cyan('Current Branch: ') + chalk.white(infoResult.data.branch));

            if (pendingChanges > 0)
                console.log(chalk.yellow(`⚠️ ${pendingChanges} pending change(s). Use 'sync' command.`));
            else console.log(chalk.green('✓ Repository up to date.'));
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'showRepositoryInfo');
            return Result.failure(
                `Failed to show repository info: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async setupRepositoryMenu(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(REPOSITORY_UI.SECTION_HEADER.TITLE, REPOSITORY_UI.SECTION_HEADER.ICON);
            const setupAction = await command.selectMenu<'local' | 'remote' | 'back'>('Choose a setup option:', [
                { name: 'Clone from a remote repository', value: 'remote' },
                { name: 'Use an existing local folder', value: 'local' }
            ]);

            if (setupAction === 'back') return Result.success(undefined);

            let result: ApiResult<void>;

            if (setupAction === 'remote') result = await this.setupFromRemote(command);
            else if (setupAction === 'local') result = await this.setupFromLocalRepo(command);
            else throw new Error(`Invalid setup action: ${setupAction}`);

            if (!result.success) throw new Error(result.error);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setupRepositoryMenu');
            return Result.failure(
                `Failed repository setup menu: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async setupFromRemote(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const configResult = await this.configFacade.getConfigValue('REMOTE_REPOSITORY');
            const defaultUrl = configResult.success ? configResult.data : '';
            const remoteUrl = await command.getInput('Enter Git repository URL:', {
                default: defaultUrl,
                nonInteractive: false,
                allowCancel: true
            });

            if (!remoteUrl) {
                this.loggerService.warn('Remote URL input cancelled or empty.');
                return Result.failure('Setup cancelled: Remote URL required.');
            }

            const spinner = this.textFormatter.createSpinner('Setting up repository...');
            spinner.start();
            const result = await this.repositoryFacade.setupFromRemoteUrl(remoteUrl);

            if (!result.success) {
                spinner.fail('Setup failed');
                console.error(this.textFormatter.errorMessage(result.error || 'Unknown error'));
                throw new Error(result.error || 'Failed setup from remote');
            }

            spinner.succeed('Repository setup complete');
            console.log(chalk.green(`\n✅ Repo cloned to ${result.data || ''}`));
            const configSetResult = await this.configFacade.setConfig('REMOTE_REPOSITORY', remoteUrl);

            if (!configSetResult.success) this.loggerService.warn(`Could not save repo URL: ${configSetResult.error}`);

            console.log(chalk.cyan('\nRun sync command:'));
            console.log(chalk.white('\n  prompt-library-cli sync'));
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setupFromRemote');
            return Result.failure(
                `Failed setup from remote: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async setupFromLocalRepo(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const localDir = await command.getInput('Enter path to local repository:', {
                default: '',
                nonInteractive: false,
                allowCancel: true
            });

            if (!localDir) {
                this.loggerService.warn('Local directory input cancelled or empty.');
                return Result.failure('Setup cancelled: Local directory path required.');
            }

            const spinner = this.textFormatter.createSpinner('Setting up from local directory...');
            spinner.start();
            const result = await this.repositoryFacade.setupFromLocalDirectory(localDir);

            if (!result.success) {
                spinner.fail('Setup failed');
                console.error(this.textFormatter.errorMessage(result.error || 'Unknown error'));
                throw new Error(result.error || 'Failed setup from local');
            }

            spinner.succeed('Repository setup complete');
            console.log(chalk.green(`\n✅ Repo setup at ${result.data?.path || ''}`));

            if (result.data?.url) {
                const configResult = await this.configFacade.setConfig('REMOTE_REPOSITORY', result.data.url);

                if (!configResult.success) this.loggerService.warn(`Could not save repo URL: ${configResult.error}`);
            }

            console.log(chalk.cyan('\nRun sync command:'));
            console.log(chalk.white('\n  prompt-library-cli sync'));
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setupFromLocalRepo');
            return Result.failure(`Failed setup from local: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async changeBranch(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const branchesResult = await this.repositoryFacade.getRepoBranches();

            if (!branchesResult.success || !branchesResult.data)
                throw new Error(branchesResult.error || 'Failed get branches');

            const branches = branchesResult.data;
            const currentBranchResult = await this.repositoryFacade.getCurrentBranch();
            const currentBranch = currentBranchResult.success ? currentBranchResult.data : 'unknown';
            console.log(chalk.bold('\nCurrent branch: ') + chalk.green(currentBranch || 'unknown'));
            console.log(chalk.bold('\nAvailable branches:'));
            const branchAction = await command.selectMenu<string | 'new' | 'back'>('Select a branch to checkout:', [
                ...branches.map((branch) => ({
                    name: `${branch} ${branch === currentBranch ? chalk.green('(current)') : ''}`,
                    value: branch,
                    disabled: branch === currentBranch
                })),
                { name: chalk.cyan('Create new branch'), value: 'new' }
            ]);

            if (branchAction === 'back') return Result.success(undefined);

            let result: ApiResult<void>;

            if (branchAction === 'new') result = await this.createAndCheckoutNewBranch(command);
            else result = await this.checkoutExistingBranch(branchAction);

            if (!result.success) throw new Error(result.error);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'changeBranch');
            return Result.failure(`Failed to change branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async createAndCheckoutNewBranch(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const branchName = await command.getInput('Enter new branch name:', { allowCancel: true });

            if (!branchName) {
                this.loggerService.warn('Branch creation cancelled.');
                return Result.failure('Branch creation cancelled.');
            }

            const spinner = this.textFormatter.createSpinner(`Creating branch: ${branchName}...`);
            spinner.start();
            const createResult = await this.repositoryFacade.createAndCheckoutBranch(branchName);

            if (createResult.success) spinner.succeed(`Branch created & checked out: ${branchName}`);
            else {
                spinner.fail('Failed create branch');
                console.error(this.textFormatter.errorMessage(createResult.error || 'Unknown error'));
                throw new Error(createResult.error || 'Failed create/checkout branch');
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'createAndCheckoutNewBranch');
            return Result.failure(
                `Failed create/checkout branch: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async checkoutExistingBranch(branchName: string): Promise<ApiResult<void>> {
        try {
            const spinner = this.textFormatter.createSpinner(`Checking out branch: ${branchName}...`);
            spinner.start();
            const checkoutResult = await this.repositoryFacade.checkoutBranch(branchName);

            if (checkoutResult.success) spinner.succeed(`Branch checked out: ${branchName}`);
            else {
                spinner.fail('Failed checkout branch');
                console.error(this.textFormatter.errorMessage(checkoutResult.error || 'Unknown error'));
                throw new Error(checkoutResult.error || 'Failed checkout branch');
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'checkoutExistingBranch');
            return Result.failure(`Failed checkout branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async listBranches(): Promise<ApiResult<string[]>> {
        try {
            const branchesResult = await this.repositoryFacade.getRepoBranches();

            if (!branchesResult.success || !branchesResult.data)
                throw new Error(branchesResult.error || 'Failed get branches');
            return Result.success(branchesResult.data);
        } catch (error) {
            this.errorService.handleError(error, 'listBranches');
            return Result.failure(`Failed list branches: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async getRepositoryStatus(): Promise<
        ApiResult<{ branch: string; url: string; pendingChanges: number; isUpToDate: boolean }>
    > {
        try {
            const infoResult = await this.repositoryFacade.getRepositoryInfo();

            if (!infoResult.success || !infoResult.data) throw new Error(infoResult.error || 'Failed get repo info');

            const configResult = await this.configFacade.getConfig();

            if (!configResult.success || !configResult.data) throw new Error(configResult.error || 'Failed get config');

            const repoUrl = configResult.data.REMOTE_REPOSITORY || '';
            const countResult = await this.repositoryFacade.countPendingChanges();
            const pendingChanges = countResult.success && countResult.data !== undefined ? countResult.data : 0;
            return Result.success({
                branch: infoResult.data.branch || 'unknown',
                url: repoUrl,
                pendingChanges,
                isUpToDate: pendingChanges === 0
            });
        } catch (error) {
            this.errorService.handleError(error, 'getRepositoryStatus');
            return Result.failure(`Failed get repo status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async initializeRepository(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const isSetupResult = await this.repositoryFacade.isLibraryRepositorySetup();

            if (isSetupResult.success && isSetupResult.data) {
                const shouldReinitialize = await command.confirmAction('Repo exists. Reinitialize?', {
                    default: false
                });

                if (!shouldReinitialize) return Result.success(undefined);
            }

            const spinner = this.textFormatter.createSpinner('Initializing repository...');
            spinner.start();
            const initResult = await this.repositoryFacade.initRepository();

            if (!initResult.success) {
                spinner.fail('Failed init repo');
                throw new Error(initResult.error || 'Failed init repo');
            }

            spinner.succeed('Repository initialized');
            const shouldAddRemote = await command.confirmAction('Add remote repository?', { default: true });

            if (shouldAddRemote) {
                const remoteUrl = await command.getInput('Enter remote repository URL:', {
                    nonInteractive: false,
                    allowCancel: true
                });

                if (remoteUrl) {
                    const addRemoteResult = await this.repositoryFacade.addRemote('origin', remoteUrl);

                    if (!addRemoteResult.success)
                        console.error(this.textFormatter.errorMessage(addRemoteResult.error || 'Failed add remote'));
                    else {
                        console.log(chalk.green('Remote added'));
                        this.configFacade.setConfig('REMOTE_REPOSITORY', remoteUrl);
                    }
                } else {
                    this.loggerService.info('Adding remote cancelled.');
                }
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'initializeRepository');
            return Result.failure(`Failed init repo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async displayDetailedRepositoryInfo(): Promise<ApiResult<void>> {
        try {
            const statusResult = await this.getRepositoryStatus();

            if (!statusResult.success || !statusResult.data)
                throw new Error(statusResult.error || 'Failed get repo status');

            const status = statusResult.data;
            const changesResult = await this.repositoryFacade.getLibraryRepositoryChanges();
            const changes = changesResult.success && changesResult.data ? changesResult.data : [];
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Repository Information', '📂');
            console.log(chalk.bold('Basic Information:'));
            console.log(`${chalk.cyan('Local Directory:')} ${chalk.white(BASE_DIR)}`);
            console.log(`${chalk.cyan('Remote URL:')} ${chalk.white(status.url || 'Not configured')}`);
            console.log(`${chalk.cyan('Current Branch:')} ${chalk.white(status.branch || 'unknown')}`);
            console.log(
                `${chalk.cyan('Status:')} ${status.isUpToDate ? chalk.green('Up to date') : chalk.yellow('Changes pending')}`
            );

            if (changes.length > 0) {
                console.log(chalk.bold('\nPending Changes:'));
                console.log('─'.repeat(50));

                for (const change of changes) {
                    const type =
                        change.status === 'A'
                            ? 'add'
                            : change.status === 'D'
                              ? 'delete'
                              : change.status === '?'
                                ? 'untracked'
                                : 'modify';
                    const color =
                        type === 'add'
                            ? chalk.green
                            : type === 'delete'
                              ? chalk.red
                              : type === 'untracked'
                                ? chalk.blue
                                : chalk.yellow;
                    console.log(`${color(type.padEnd(10))} ${change.path}`);
                }
                console.log('─'.repeat(50));
                console.log(chalk.cyan(`Total: ${changes.length} change(s)`));
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'displayDetailedRepositoryInfo');
            return Result.failure(
                `Failed display repo info: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
