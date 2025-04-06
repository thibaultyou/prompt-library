import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';
import fs from 'fs-extra';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { SETUP_UI } from '../../shared/constants';
import { ApiResult, Result, CommandInterface } from '../../shared/types';
import { ConfigFacade } from '../facades/config.facade';
import { RepositoryFacade } from '../facades/repository.facade';

@Injectable({ scope: Scope.DEFAULT })
export class SetupCommandService {
    constructor(
        private readonly repositoryFacade: RepositoryFacade,
        private readonly configFacade: ConfigFacade,
        private readonly uiFacade: UiFacade,
        private readonly textFormatter: TextFormatter,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    public async checkIfSetupNeeded(): Promise<ApiResult<boolean>> {
        try {
            const isSetupResult = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!isSetupResult.success) {
                throw new Error(`Failed to check repository status: ${isSetupResult.error}`);
            }
            return Result.success(!isSetupResult.data);
        } catch (error) {
            this.errorService.handleError(error, 'checkIfSetupNeeded');
            return Result.failure(`Failed check setup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async confirmSetupRedo(command: CommandInterface): Promise<ApiResult<boolean>> {
        try {
            const shouldRedo = await command.confirmAction(SETUP_UI.INFO.REPO_EXISTS, { default: false });
            return Result.success(shouldRedo);
        } catch (error) {
            this.errorService.handleError(error, 'confirmSetupRedo');
            return Result.failure(`Failed confirm redo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async setupRepository(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(SETUP_UI.SECTION_HEADER.TITLE, SETUP_UI.SECTION_HEADER.ICON);
            console.log(SETUP_UI.INFO.INTRO);
            const setupAction = await command.selectMenu<'local' | 'remote' | 'default' | 'back'>(
                SETUP_UI.MENU.PROMPT,
                [
                    { name: SETUP_UI.MENU.OPTIONS.REMOTE, value: 'remote' },
                    { name: SETUP_UI.MENU.OPTIONS.LOCAL, value: 'local' },
                    { name: SETUP_UI.MENU.OPTIONS.DEFAULT, value: 'default' }
                ]
            );

            if (setupAction === 'back') return Result.success(undefined);

            if (setupAction === 'remote') {
                await this.setupFromRemote(command);
            } else if (setupAction === 'local') {
                await this.setupFromLocalFolder(command);
            } else if (setupAction === 'default') {
                await this.createDefaultRepository(command);
            } else {
                throw new Error(`Invalid setup action: ${setupAction}`);
            }

            this.loggerService.info(SETUP_UI.INFO.SETUP_COMPLETE);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setupRepository');
            return Result.failure(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async setupFromRemote(command: CommandInterface): Promise<void> {
        try {
            const configResult = await this.configFacade.getConfigValue('REMOTE_REPOSITORY');
            const defaultUrl = configResult.success ? configResult.data : '';
            const remoteUrl = await command.getInput(SETUP_UI.INPUT.REMOTE_URL, {
                default: defaultUrl,
                nonInteractive: false,
                allowCancel: true
            });

            if (!remoteUrl) {
                this.loggerService.warn('Remote URL input cancelled or empty.');
                throw new Error('Setup cancelled: Remote URL required.');
            }

            const spinner = this.textFormatter.createSpinner(SETUP_UI.SPINNER.SETUP);
            spinner.start();
            const result = await this.repositoryFacade.setupFromRemoteUrl(remoteUrl);

            if (!result.success) {
                spinner.fail('Setup failed');
                console.error(this.textFormatter.errorMessage(result.error || 'Unknown error'));
                throw new Error(result.error || SETUP_UI.ERRORS.REMOTE_SETUP_FAILED);
            }

            spinner.succeed('Repository setup complete');
            console.log(chalk.green(`\n✅ ${SETUP_UI.SUCCESS.CLONED.replace('{0}', result.data || '')}`));
            const configSetResult = await this.configFacade.setConfig('REMOTE_REPOSITORY', remoteUrl);

            if (!configSetResult.success)
                this.loggerService.warn(`Could not save repository URL to config: ${configSetResult.error}`);

            console.log(chalk.cyan('\nYou can now run the sync command:'));
            console.log(chalk.white('\n  prompt-library-cli sync'));
        } catch (error) {
            this.errorService.handleError(error, 'setupFromRemote (internal)');
            throw error;
        }
    }

    private async setupFromLocalFolder(command: CommandInterface): Promise<void> {
        try {
            const localDir = await command.getInput(SETUP_UI.INPUT.LOCAL_DIR, {
                default: '',
                nonInteractive: false,
                allowCancel: true
            });

            if (!localDir) {
                this.loggerService.warn('Local directory input cancelled or empty.');
                throw new Error('Setup cancelled: Local directory path required.');
            }

            const spinner = this.textFormatter.createSpinner(SETUP_UI.SPINNER.SETUP);
            spinner.start();
            const result = await this.repositoryFacade.setupFromLocalDirectory(localDir);

            if (!result.success) {
                spinner.fail('Setup failed');
                console.error(this.textFormatter.errorMessage(result.error || 'Unknown error'));
                throw new Error(result.error || SETUP_UI.ERRORS.LOCAL_SETUP_FAILED);
            }

            spinner.succeed('Repository setup complete');
            console.log(chalk.green(`\n✅ ${SETUP_UI.SUCCESS.LOCAL_SETUP.replace('{0}', result.data?.path || '')}`));

            if (result.data?.url) {
                const configResult = await this.configFacade.setConfig('REMOTE_REPOSITORY', result.data.url);

                if (!configResult.success)
                    this.loggerService.warn(`Could not save repository URL to config: ${configResult.error}`);
            }

            console.log(chalk.cyan('\nYou can now run the sync command:'));
            console.log(chalk.white('\n  prompt-library-cli sync'));
        } catch (error) {
            this.errorService.handleError(error, 'setupFromLocalFolder (internal)');
            throw error;
        }
    }

    private async createDefaultRepository(_command: CommandInterface): Promise<void> {
        try {
            const spinner = this.textFormatter.createSpinner(SETUP_UI.SPINNER.DEFAULT_REPO);
            spinner.start();
            const tempDir = path.join(process.cwd(), `temp-repo-${Date.now()}`);
            await fs.ensureDir(tempDir);
            await fs.ensureDir(path.join(tempDir, 'prompts'));
            await fs.ensureDir(path.join(tempDir, 'fragments'));
            const result = await this.repositoryFacade.setupFromLocalDirectory(tempDir);
            await fs.remove(tempDir);

            if (!result.success) {
                spinner.fail('Setup failed');
                console.error(this.textFormatter.errorMessage(result.error || 'Unknown error'));
                throw new Error(result.error || SETUP_UI.ERRORS.DEFAULT_SETUP_FAILED);
            }

            spinner.succeed(SETUP_UI.SUCCESS.DEFAULT_CREATED);
            console.log(chalk.green(SETUP_UI.SUCCESS.SETUP_LOCATION.replace('{0}', result.data?.path || '')));
            console.log(chalk.cyan(`\n${SETUP_UI.SUCCESS.NEXT_STEPS}`));
            console.log(SETUP_UI.SUCCESS.EXAMPLE_COMMAND);
        } catch (error) {
            this.errorService.handleError(error, 'createDefaultRepository (internal)');
            throw error;
        }
    }

    public async verifySetupComplete(): Promise<ApiResult<boolean>> {
        try {
            const repoSetupResult = await this.repositoryFacade.isLibraryRepositorySetup();

            if (!repoSetupResult.success) {
                throw new Error(`Failed to verify repository setup: ${repoSetupResult.error}`);
            }
            return Result.success(repoSetupResult.data ?? false);
        } catch (error) {
            this.errorService.handleError(error, 'verifySetupComplete');
            return Result.failure(`Failed verify setup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async initializeDirectories(): Promise<ApiResult<void>> {
        try {
            await fs.ensureDir(path.join(process.cwd(), 'prompts'));
            await fs.ensureDir(path.join(process.cwd(), 'fragments'));
            this.loggerService.info('Required directories initialized');
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'initializeDirectories');
            return Result.failure(`Failed init directories: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async validateSetup(): Promise<
        ApiResult<{ repositoryValid: boolean; configValid: boolean; directoriesValid: boolean }>
    > {
        try {
            const repoResult = await this.repositoryFacade.isLibraryRepositorySetup();
            const configResult = await this.configFacade.getConfig();
            const directoriesValid = true;
            return Result.success({
                repositoryValid: !!(repoResult.success && repoResult.data),
                configValid: configResult.success && !!configResult.data,
                directoriesValid
            });
        } catch (error) {
            this.errorService.handleError(error, 'validateSetup');
            return Result.failure(`Failed validate setup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
