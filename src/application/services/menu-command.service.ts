import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { ConfigInteractionOrchestratorService } from './config-interaction-orchestrator.service';
import { EnvInteractionOrchestratorService } from './env-interaction-orchestrator.service';
import { FragmentInteractionOrchestratorService } from './fragment-interaction-orchestrator.service';
import { ModelCommandService } from './model-command.service';
import { PromptInteractionOrchestratorService } from './prompt-interaction-orchestrator.service';
import { PromptInteractionService } from './prompt-interaction.service';
import { RepositoryCommandService } from './repository-command.service';
import { SetupCommandService } from './setup-command.service';
import { SyncCommandService } from './sync-command.service';
import { IPromptExecutionRepository } from '../../core/prompt/repositories/prompt-execution.repository.interface';
import { IPromptFavoriteRepository } from '../../core/prompt/repositories/prompt-favorite.repository.interface';
import { FlushCommandService } from '../../infrastructure/database/services/flush.service';
import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { getConfigValue } from '../../shared/config';
import { STYLE_TYPES, INFO_MESSAGES, ERROR_MESSAGES, PROVIDERS } from '../../shared/constants';
import {
    MenuItem,
    MenuAction,
    ApiResult,
    Result,
    CommandInterface,
    CategoryItem,
    SyncChangeItem
} from '../../shared/types';
import { FavoritesPromptCommand } from '../commands/prompt/favorites-prompt.command';
import { RecentPromptCommand } from '../commands/prompt/recent-prompt.command';
import { PromptFacade } from '../facades/prompt.facade';
import { RepositoryFacade } from '../facades/repository.facade';
import { SyncFacade } from '../facades/sync.facade';

@Injectable({ scope: Scope.DEFAULT })
export class MenuCommandService {
    constructor(
        private readonly loggerService: LoggerService,
        private readonly uiFacade: UiFacade,
        private readonly textFormatter: TextFormatter,
        private readonly repositoryFacade: RepositoryFacade,
        private readonly promptFacade: PromptFacade,
        private readonly syncFacade: SyncFacade,
        private readonly syncCommandService: SyncCommandService,
        @Inject(IPromptExecutionRepository) private readonly promptExecRepo: IPromptExecutionRepository,
        @Inject(IPromptFavoriteRepository) private readonly promptFavRepo: IPromptFavoriteRepository,
        private readonly promptInteractionService: PromptInteractionService,
        private readonly errorService: ErrorService,
        private readonly modelCommandService: ModelCommandService,
        private readonly repositoryCommandService: RepositoryCommandService,
        private readonly setupCommandService: SetupCommandService,
        private readonly flushCommandService: FlushCommandService,
        @Inject(forwardRef(() => PromptInteractionOrchestratorService))
        private readonly promptInteractionOrchestratorService: PromptInteractionOrchestratorService,
        @Inject(forwardRef(() => FragmentInteractionOrchestratorService))
        private readonly fragmentInteractionOrchestratorService: FragmentInteractionOrchestratorService,
        @Inject(forwardRef(() => EnvInteractionOrchestratorService))
        private readonly envInteractionOrchestratorService: EnvInteractionOrchestratorService,
        @Inject(forwardRef(() => ConfigInteractionOrchestratorService))
        private readonly configInteractionOrchestratorService: ConfigInteractionOrchestratorService,
        @Inject(forwardRef(() => FavoritesPromptCommand))
        private readonly favoritesProvider: FavoritesPromptCommand,
        @Inject(forwardRef(() => RecentPromptCommand))
        private readonly recentProvider: RecentPromptCommand
    ) {}

    public async showMainMenu(command: CommandInterface): Promise<void> {
        this.loggerService.debug('Entering main menu loop...');
        let keepMenuOpen = true;
        while (keepMenuOpen) {
            try {
                const setupNeededResult = await this.setupCommandService.checkIfSetupNeeded();

                if (setupNeededResult.success && setupNeededResult.data) {
                    this.uiFacade.clearConsole();
                    this.loggerService.warn(INFO_MESSAGES.REPO_NOT_FOUND);
                    this.loggerService.info(INFO_MESSAGES.SETUP_PROMPT);
                    this.loggerService.info(chalk.bold(`\n  ${INFO_MESSAGES.SETUP_COMMAND}\n`));
                    const runSetup = await command.confirmAction('Run setup now?', { default: true });

                    if (runSetup) {
                        await this.setupCommandService.setupRepository(command);
                        const setupComplete = await this.setupCommandService.verifySetupComplete();

                        if (!setupComplete.success || !setupComplete.data) {
                            this.loggerService.error('Setup did not complete successfully. Exiting menu.');
                            await command.pressKeyToContinue();
                            keepMenuOpen = false;
                            continue;
                        }

                        this.loggerService.success('Setup completed. Continuing to main menu.');
                        await command.pressKeyToContinue();
                    } else {
                        this.loggerService.info('Setup skipped. Exiting.');
                        keepMenuOpen = false;
                        continue;
                    }
                } else if (!setupNeededResult.success) {
                    this.loggerService.error(
                        `Failed to check repository setup: ${setupNeededResult.error}. Exiting menu.`
                    );
                    await command.pressKeyToContinue();
                    keepMenuOpen = false;
                    continue;
                }

                await this.displayInfoHeader();
                const choices = (await this.generateMenuChoices()) as MenuItem<MenuAction>[];
                const action = await command.selectMenu<MenuAction>('Select an option:', choices, {
                    menuType: 'main',
                    goBackLabel: 'Exit'
                });

                if (action === 'back') {
                    keepMenuOpen = false;
                    this.loggerService.info(INFO_MESSAGES.EXITING);
                } else {
                    await this.handleMenuAction(action, command);
                }
            } catch (error) {
                if (error instanceof Error && error.message === 'User cancelled selection') {
                    this.loggerService.warn('Menu selection cancelled.');
                } else {
                    this.errorService.handleCommandError(error, 'main menu loop');
                    await command.pressKeyToContinue('An error occurred. Press any key to return to the menu.');
                }
            }
        }
        this.loggerService.debug('Exited main menu loop.');
    }

    public async generateMenuChoices(): Promise<MenuItem[]> {
        const choices: MenuItem[] = [];
        let recentPrompts: any[] = [];
        let hasFavorites = false;
        let hasPendingChanges = false;

        try {
            const recentExecutionsResult = await this.promptExecRepo.getRecentExecutions(3);
            recentPrompts =
                recentExecutionsResult.success && recentExecutionsResult.data ? recentExecutionsResult.data : [];
            hasFavorites = await this.promptFavRepo.hasFavoritePrompts();
            const pendingChangesResult = await this.repositoryFacade.hasLibraryRepositoryChanges();
            hasPendingChanges =
                pendingChangesResult.success && pendingChangesResult.data ? pendingChangesResult.data : false;
        } catch (error) {
            this.loggerService.error('Error fetching menu data:', error);
        }

        const spacerValue = 'spacer' as any;
        choices.push({ name: '─'.repeat(50), value: spacerValue, disabled: true, type: 'separator' });
        choices.push(this.textFormatter.createSectionHeader<MenuAction>('QUICK ACTIONS', '✨', STYLE_TYPES.SUCCESS));

        if (recentPrompts.length > 0) {
            const lastPrompt = recentPrompts[0];
            choices.push(
                this.uiFacade.formatMenuItem(
                    `Run last prompt: ${chalk.italic(lastPrompt.title || 'Unknown')}`,
                    'last_prompt',
                    STYLE_TYPES.SUCCESS
                )
            );
        }

        if (hasFavorites) {
            choices.push(this.uiFacade.formatMenuItem('Favorite prompts', 'favorites', STYLE_TYPES.SUCCESS));
        }

        choices.push(this.uiFacade.formatMenuItem('Search prompts by keyword', 'search_prompts', STYLE_TYPES.SUCCESS));
        choices.push({ name: '─'.repeat(50), value: spacerValue, disabled: true, type: 'separator' });
        choices.push(this.textFormatter.createSectionHeader<MenuAction>('LIBRARY', '📚', STYLE_TYPES.INFO));
        choices.push(this.uiFacade.formatMenuItem('Prompts library', 'prompt', STYLE_TYPES.PRIMARY));
        choices.push(this.uiFacade.formatMenuItem('Prompt fragments', 'fragment', STYLE_TYPES.PRIMARY));
        choices.push(this.uiFacade.formatMenuItem('Environment variables', 'env', STYLE_TYPES.PRIMARY));
        choices.push({ name: '─'.repeat(50), value: spacerValue, disabled: true, type: 'separator' });
        choices.push(this.textFormatter.createSectionHeader<MenuAction>('CONFIGURATION', '🔧', STYLE_TYPES.INFO));
        choices.push(this.uiFacade.formatMenuItem('Configure AI model', 'model', STYLE_TYPES.PRIMARY));
        choices.push(this.uiFacade.formatMenuItem('Configure CLI', 'config', STYLE_TYPES.PRIMARY));
        choices.push({ name: '─'.repeat(50), value: spacerValue, disabled: true, type: 'separator' });
        choices.push(this.textFormatter.createSectionHeader<MenuAction>('REPOSITORY', '💾', STYLE_TYPES.INFO));

        if (hasPendingChanges) {
            choices.push(this.uiFacade.formatMenuItem('Manage pending changes', 'list_changes', STYLE_TYPES.WARNING));
        }

        choices.push(this.uiFacade.formatMenuItem('Sync with remote repository', 'sync', STYLE_TYPES.PRIMARY));
        choices.push(this.uiFacade.formatMenuItem('Configure repository', 'repository', STYLE_TYPES.PRIMARY));
        return choices;
    }

    public async displayInfoHeader(): Promise<void> {
        try {
            const modelProviderValue = getConfigValue('MODEL_PROVIDER');
            const modelName = getConfigValue(
                modelProviderValue === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL'
            );
            const repoUrl = getConfigValue('REMOTE_REPOSITORY');
            let branch = getConfigValue('DEFAULT_BRANCH');
            let hasPendingChanges = false;

            try {
                const branchResult = await this.repositoryFacade.getCurrentBranch();

                if (branchResult.success && branchResult.data) branch = branchResult.data;
            } catch (error) {
                this.loggerService.error('Error getting current branch:', error);
            }

            try {
                const pendingChangesResult = await this.repositoryFacade.hasLibraryRepositoryChanges();
                hasPendingChanges =
                    pendingChangesResult.success && pendingChangesResult.data ? pendingChangesResult.data : false;
                this.loggerService.debug(`Repository changes detected: ${hasPendingChanges}`);
            } catch (error) {
                this.loggerService.error('Error checking for repository changes:', error);
            }

            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Prompt Library CLI', '🧠');
            console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProviderValue)} / ${chalk.cyan(modelName)}`);
            let repoDisplay = chalk.red('Not configured');

            if (repoUrl) {
                const displayUrl = repoUrl.length > 50 ? repoUrl.substring(0, 47) + '...' : repoUrl;
                repoDisplay = chalk.cyan(displayUrl);
            }

            console.log(`${chalk.gray('Repository:')} ${repoDisplay}`);
            console.log(`${chalk.gray('Branch:')} ${chalk.cyan(branch)}`);
            console.log(
                `${chalk.gray('Status:')} ${repoUrl ? (hasPendingChanges ? chalk.yellow('⚠️ Changes pending') : chalk.green('✓ Up to date')) : chalk.red('⚠️ Not synced')}`
            );
        } catch (error) {
            console.log(chalk.gray('Status information unavailable'));
            this.loggerService.error('Error displaying info header:', error);
        }
    }

    public async handleMenuAction(action: MenuAction, command: CommandInterface): Promise<ApiResult<void>> {
        try {
            this.uiFacade.clearConsole();
            switch (action) {
                case 'last_prompt':
                    await this.executeLastPrompt(command);
                    break;
                case 'search_prompts':
                    await this.searchPromptWorkflow(command);
                    break;
                case 'list_changes':
                    await this.displayPendingChanges(command);
                    break;
                case 'prompt':
                    await this.promptInteractionOrchestratorService.startPromptInteractionWorkflow(command);
                    break;
                case 'fragment':
                    await this.fragmentInteractionOrchestratorService.startFragmentInteractionWorkflow(command);
                    break;
                case 'env':
                    await this.envInteractionOrchestratorService.startEnvInteractionWorkflow(command);
                    break;
                case 'model':
                    await this.modelCommandService.handleInteractiveMode(command);
                    break;
                case 'config':
                    await this.configInteractionOrchestratorService.startConfigInteractionWorkflow(command);
                    break;
                case 'repository':
                    await this.repositoryCommandService.setupRepositoryMenu(command);
                    break;
                case 'sync': {
                    this.syncCommandService.performDbSync();
                    const syncResult = await this.syncCommandService.executeSyncWithRemote(undefined, false);

                    if (
                        !syncResult.success &&
                        syncResult.error === 'Remote changes need confirmation' &&
                        syncResult.meta?.diff
                    ) {
                        await this.handleSyncConfirmation(command, syncResult.meta.diff as string);
                    } else if (!syncResult.success) {
                        this.loggerService.error(`Sync failed: ${syncResult.error}`);
                    }

                    await command.pressKeyToContinue();
                    break;
                }
                case 'favorites': {
                    await this.favoritesProvider.run([], { nonInteractive: false });
                    await command.pressKeyToContinue();
                    break;
                }
                case 'recent': {
                    await this.recentProvider.run([], { nonInteractive: false });
                    await command.pressKeyToContinue();
                    break;
                }
                default: {
                    const validActions: MenuAction[] = [
                        'last_prompt',
                        'search_prompts',
                        'list_changes',
                        'prompt',
                        'fragment',
                        'env',
                        'model',
                        'config',
                        'repository',
                        'sync',
                        'flush',
                        'favorites',
                        'recent',
                        'back'
                    ];

                    if (validActions.includes(action)) {
                        this.loggerService.warn(`Unhandled menu action: ${action}`);
                    } else {
                        this.loggerService.error(`Invalid action received: ${action}`);
                    }
                    return Result.failure(`Unhandled or invalid menu action: ${action}`);
                }
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleCommandError(error, `menu action: ${action}`);
            await command.pressKeyToContinue();
            return Result.failure(
                `Error handling menu action ${action}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async executeLastPrompt(command: CommandInterface): Promise<ApiResult<boolean>> {
        try {
            this.loggerService.info('Fetching recent executions for last prompt...');
            const recentExecutionsResult = await this.promptExecRepo.getRecentExecutions(1);
            const recentExecutions = recentExecutionsResult.data || [];
            this.loggerService.info(`Recent executions found: ${recentExecutions.length}`);

            if (recentExecutions.length > 0) {
                const mostRecentPromptId = recentExecutions[0].prompt_id as number;
                this.loggerService.info(`Found last executed prompt ID: ${mostRecentPromptId}`);
                const promptDetails = await this.promptFacade.getPromptById(Number(mostRecentPromptId));

                if (!promptDetails.success || !promptDetails.data) {
                    this.loggerService.warn(`Could not find details for prompt ID: ${mostRecentPromptId}`);
                    await command.pressKeyToContinue();
                    return Result.failure('Prompt details not found', { data: false });
                }

                this.loggerService.info(`Found prompt: ${promptDetails.data.title} (ID: ${mostRecentPromptId})`);
                this.uiFacade.clearConsole();
                const prompt = promptDetails.data;
                const categoryItem: CategoryItem = {
                    id: String(prompt.id),
                    title: prompt.title,
                    category: prompt.primary_category,
                    primary_category: prompt.primary_category,
                    description: prompt.one_line_description || '',
                    path: prompt.directory || '',
                    subcategories: []
                };
                await this.promptInteractionService.managePrompt(command, categoryItem);
                return Result.success(true);
            } else {
                this.loggerService.warn('No recent prompt executions found.');
                await command.pressKeyToContinue();
                return Result.failure('No recent prompt executions found', { data: false });
            }
        } catch (error) {
            this.loggerService.error('Error executing last prompt:', error);
            return Result.failure(
                `Error executing last prompt: ${error instanceof Error ? error.message : String(error)}`,
                { data: false }
            );
        }
    }

    private async searchPromptWorkflow(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Search Prompts', '🔍');
            const keyword = await command.getInput('Enter search keyword:', { allowCancel: true });

            if (keyword === null) return Result.success(undefined);

            if (keyword && keyword.trim()) {
                const searchResult = await this.promptFacade.searchPrompts(keyword.trim());

                if (!searchResult || searchResult.length === 0) {
                    this.loggerService.warn(`No prompts found matching: "${keyword.trim()}"`);
                    await command.pressKeyToContinue();
                    return Result.success(undefined);
                }

                const tableData = this.promptFacade.formatPromptsTable(searchResult);
                const tableChoices = this.uiFacade.createTableMenuChoices<CategoryItem>(tableData, {
                    infoText: `Found ${searchResult.length} results for "${keyword.trim()}"`
                });
                const selection = await command.selectMenu<CategoryItem | 'back'>('Select a prompt:', tableChoices);

                if (selection !== 'back') {
                    await this.promptInteractionService.managePrompt(command, selection);
                }
                return Result.success(undefined);
            } else {
                this.loggerService.warn('Search keyword cannot be empty.');
                await command.pressKeyToContinue();
                return Result.success(undefined);
            }
        } catch (error) {
            this.loggerService.error('Error searching prompts:', error);
            return Result.failure(`Error searching prompts: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async displayPendingChanges(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            this.uiFacade.printSectionHeader('Manage Pending Changes', '📋');
            const changesResult = await this.syncCommandService.getChangesForReset();

            if (
                !changesResult.success ||
                !changesResult.data ||
                (changesResult.data.promptChanges.length === 0 && changesResult.data.fragmentChanges.length === 0)
            ) {
                this.uiFacade.print(chalk.green('\nNo pending changes found in prompts or fragments.'));
                await command.pressKeyToContinue();
                return Result.success(undefined);
            }

            const { promptChanges, fragmentChanges } = changesResult.data;

            if (promptChanges.length > 0) {
                this.uiFacade.print(chalk.bold('\nPrompt changes:'));
                promptChanges.forEach((c: { type: string; path: string; originalType: string }) => {
                    const pathParts = c.path.split(path.sep);
                    const directory = pathParts[0];
                    const displayType =
                        c.type === 'Delete'
                            ? 'delete'
                            : c.type === 'Restore'
                              ? c.originalType === 'deleted'
                                  ? 'restore'
                                  : 'modify'
                              : 'unknown';
                    this.uiFacade.print(`${this.uiFacade.formatOperationType(displayType)} ${directory}`);
                });
            }

            if (fragmentChanges.length > 0) {
                this.uiFacade.print(chalk.bold('\nFragment changes:'));
                fragmentChanges.forEach((c: { type: string; path: string; originalType: string }) => {
                    const pathParts = c.path.split(path.sep);
                    let category = '';
                    let name = '';

                    if (pathParts.length >= 2) {
                        category = pathParts[0];
                        name = pathParts[1].replace(/\.md$/, '');
                    } else if (pathParts.length === 1) {
                        name = pathParts[0].replace(/\.md$/, '');
                    }

                    const displayType =
                        c.type === 'Delete'
                            ? 'delete'
                            : c.type === 'Restore'
                              ? c.originalType === 'deleted'
                                  ? 'restore'
                                  : 'modify'
                              : 'unknown';
                    this.uiFacade.print(`${this.uiFacade.formatOperationType(displayType)} ${category}/${name}`);
                });
            }

            const action = await command.selectMenu<'push' | 'reset' | 'back'>('What would you like to do?', [
                { name: 'Push changes to remote repository', value: 'push' },
                { name: 'Reset/discard changes', value: 'reset' }
            ]);

            if (action === 'push') {
                this.uiFacade.clearConsole();
                const pushPrep = await this.syncCommandService.pushPendingChanges();

                if (pushPrep.success && pushPrep.data) {
                    this.loggerService.info('Ready to push. Run `sync --push` or use the main sync option.');
                    await command.pressKeyToContinue();
                } else {
                    this.loggerService.error(`Failed to prepare push: ${pushPrep.error}`);
                    await command.pressKeyToContinue();
                }
            } else if (action === 'reset') {
                this.uiFacade.clearConsole();
                const allChanges: SyncChangeItem[] = [
                    ...promptChanges.map((c: { path: string; originalType: string }) => ({
                        type: 'prompt' as const,
                        path: c.path,
                        changeType: c.originalType
                    })),
                    ...fragmentChanges.map((c: { path: string; originalType: string }) => ({
                        type: 'fragment' as const,
                        path: c.path,
                        changeType: c.originalType
                    }))
                ];
                const confirmReset = await command.confirmAction(
                    `Reset ${allChanges.length} change(s)? Cannot be undone.`
                );

                if (confirmReset) {
                    await this.syncCommandService.resetLocalChanges(allChanges);
                } else {
                    this.loggerService.info('Reset cancelled.');
                }

                await command.pressKeyToContinue();
            }
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error displaying changes:', error);
            return Result.failure(
                `Error displaying changes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async handleSyncConfirmation(command: CommandInterface, diff: string): Promise<void> {
        this.loggerService.info('Review remote changes:');
        this.loggerService.warn('Applying will update local files.');
        console.log(`\n${diff}\n`);
        const shouldProceed = await command.confirmAction(INFO_MESSAGES.PROCEED_CONFIRMATION);

        if (shouldProceed) {
            this.loggerService.info('Pulling changes...');
            const spinner = this.uiFacade.showSpinner('Pulling changes...');
            const pullResult = await this.syncFacade.pullFromRemote();

            if (pullResult.success) {
                spinner.succeed('Sync completed successfully!');
                await this.syncCommandService.performDbSync();
            } else {
                spinner.fail(ERROR_MESSAGES.PULL_FAILED.replace('{0}', pullResult.error || 'Unknown'));
            }
        } else {
            this.loggerService.info('Sync cancelled by user.');
        }
    }
}
