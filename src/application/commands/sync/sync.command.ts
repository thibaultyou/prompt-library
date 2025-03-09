import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { Command, Option } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService as InfraRepoService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import {
    SYNC_UI,
    WARNING_MESSAGES,
    ERROR_MESSAGES,
    INFO_MESSAGES,
    GENERIC_ERRORS,
    SUCCESS_MESSAGES
} from '../../../shared/constants';
import { SyncCommandOptionsEx, SyncResetResult, SyncChangeItem, ChangeType } from '../../../shared/types';
import { FragmentFacade } from '../../facades/fragment.facade';
import { RepositoryFacade } from '../../facades/repository.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedSyncOptions extends SyncCommandOptionsEx {
    url?: string;
    force?: boolean;
    push?: boolean;
    list?: boolean;
    reset?: boolean;
    branch?: string;
    json?: boolean;
    nonInteractive?: boolean;
    isInteractive?: boolean;
}

@Injectable()
@Command({
    name: 'sync',
    description: 'Sync prompts with the remote repository'
})
export class SyncCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        infraRepoService: InfraRepoService,
        loggerService: LoggerService,
        private readonly syncCommandService: SyncCommandService,
        private readonly fragmentCommandService: FragmentCommandService,
        private readonly syncFacade: SyncFacade,
        private readonly repositoryFacade: RepositoryFacade,
        private readonly fragmentFacade: FragmentFacade
    ) {
        super(uiFacade, errorService, infraRepoService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedSyncOptions): Promise<void> {
        const opts = options || {};
        const isInteractive =
            opts.isInteractive ?? (!opts.push && !opts.reset && !opts.list && !opts.url && !opts.force);
        this.loggerService.debug(
            `Running sync command. Options: ${JSON.stringify(opts)}, Interactive: ${isInteractive}`
        );

        try {
            if (opts.list) await this.listPendingChanges(isInteractive);
            else if (opts.push) await this.pushPendingChanges(opts.branch, isInteractive);
            else if (opts.reset) await this.resetLocalChanges(isInteractive);
            else await this.syncWithRemote(opts, isInteractive);
        } catch (error) {
            this.handleError(error, 'sync command');
        } finally {
            if (isInteractive && !opts.list && !opts.reset && !opts.push) {
                await this.pressKeyToContinue();
            }
        }
    }

    @Option({ flags: '--url <url>', description: 'Set remote repository URL' })
    parseUrl(val: string): string {
        return val;
    }
    @Option({ flags: '--force', description: 'Force sync without confirmation' })
    parseForce(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--push', description: 'Push local changes' })
    parsePush(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--list', description: 'List pending changes' })
    parseList(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--reset', description: 'Reset local changes' })
    parseReset(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--branch <n>', description: 'Branch name for push/sync' })
    parseBranch(val: string): string {
        return val;
    }
    @Option({ flags: '--json', description: 'Output in JSON format' })
    parseJson(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async syncWithRemote(
        options: Pick<IParsedSyncOptions, 'url' | 'force'>,
        isInteractive: boolean
    ): Promise<void> {
        if (!(await this.checkRepositorySetup())) return;

        const repoUrlResult = await this.syncFacade.getRepoUrl(options.url);

        if (!repoUrlResult.success || !repoUrlResult.data) {
            if (isInteractive) {
                const userInput = await this.getInput(INFO_MESSAGES.ENTER_REPO_URL);

                if (!userInput) {
                    this.loggerService.error(ERROR_MESSAGES.SYNC_NO_URL);
                    return;
                }

                this.syncFacade.setRepoUrl(userInput);
                repoUrlResult.data = userInput;
            } else {
                this.loggerService.error(ERROR_MESSAGES.SYNC_NO_URL);
                return;
            }
        }

        const repoUrl = repoUrlResult.data!;
        this.loggerService.info(`Executing sync with remote: ${repoUrl}. Interactive: ${isInteractive}`);
        const syncResult = await this.syncCommandService.executeSyncWithRemote(repoUrl, options.force);

        if (!syncResult.success && syncResult.error === 'Remote changes need confirmation' && syncResult.meta?.diff) {
            await this.handleSyncConfirmation(syncResult.meta.diff as string, isInteractive);
        } else if (!syncResult.success) {
            this.handleSyncError(syncResult.error);
        } else {
            this.loggerService.success(SUCCESS_MESSAGES.SYNC_COMPLETED);
        }
    }

    private async handleSyncConfirmation(diff: string, isInteractive: boolean): Promise<void> {
        this.loggerService.info('Review remote changes:');
        this.loggerService.warn('Applying will update local files.');
        console.log(`\n${diff}\n`);
        let shouldProceed = !isInteractive;

        if (isInteractive) {
            shouldProceed = await this.confirmAction(INFO_MESSAGES.PROCEED_CONFIRMATION);
        }

        if (shouldProceed) {
            this.loggerService.info('Pulling changes...');
            const spinner = this.uiFacade.showSpinner(SYNC_UI.SPINNER.PULLING);
            const pullResult = await this.syncFacade.pullFromRemote();

            if (pullResult.success) {
                spinner.succeed(SUCCESS_MESSAGES.SYNC_COMPLETED);
                await this.syncCommandService.performDbSync();
            } else {
                spinner.fail(ERROR_MESSAGES.PULL_FAILED.replace('{0}', pullResult.error || 'Unknown'));
            }
        } else {
            this.loggerService.info('Sync cancelled by user.');
        }
    }

    private handleSyncError(error?: string): void {
        if (error === WARNING_MESSAGES.NO_CHANGES || error === 'No changes detected. Everything is up to date.') {
            this.loggerService.info(error);
        } else {
            this.loggerService.error(ERROR_MESSAGES.SYNC_ERROR, error || GENERIC_ERRORS.UNKNOWN_ERROR);
        }
    }

    private async checkRepositorySetup(): Promise<boolean> {
        const isSetUp = await this.isLibraryRepositorySetup();

        if (!isSetUp) {
            this.loggerService.warn(INFO_MESSAGES.REPO_NOT_FOUND);
            this.loggerService.info(INFO_MESSAGES.REPOSITORY_SETUP_INSTRUCTION);
        }
        return isSetUp;
    }

    private async listPendingChanges(isInteractive: boolean): Promise<void> {
        this.uiFacade.clearConsole();
        this.loggerService.debug(`List operation. Interactive: ${isInteractive}`);

        if (!(await this.checkRepositorySetup())) return;

        try {
            this.uiFacade.printSectionHeader(SYNC_UI.SECTION_HEADER.PENDING_CHANGES, '📋');
            this.loggerService.info('Fetching pending changes...');
            const pushResult = await this.syncCommandService.pushPendingChanges();

            if (!pushResult.success || !pushResult.data) {
                this.handleNoPendingChanges(pushResult.error);
                return;
            }

            console.log(pushResult.data.changesSummary);
            this.uiFacade.printSeparator();
            this.loggerService.info(chalk.cyan(`\nBranch: ${pushResult.data.branchName}`));

            if (isInteractive) {
                await this.promptForChangeAction(pushResult.data.branchName, isInteractive);
            } else {
                this.loggerService.info('\nUse --push to push or --reset to discard changes.');
            }
        } catch (error) {
            this.handleError(error, 'listing pending changes');
        }
    }

    private handleNoPendingChanges(error?: string): void {
        if (error === WARNING_MESSAGES.NO_PENDING_CHANGES || error === 'No changes to push') {
            this.loggerService.info(WARNING_MESSAGES.NO_PENDING_CHANGES);
            this.loggerService.info(chalk.gray('Local repository is in sync.'));
        } else {
            this.loggerService.error(ERROR_MESSAGES.SYNC_ERROR, error || GENERIC_ERRORS.UNKNOWN_ERROR);
        }
    }

    private async promptForChangeAction(branchName: string, isInteractive: boolean): Promise<void> {
        if (!isInteractive) return;

        const action = await this.selectMenu<typeof SYNC_UI.ACTIONS.PUSH | typeof SYNC_UI.ACTIONS.RESET | 'back'>(
            SYNC_UI.MENU.PROMPT,
            [
                { name: 'Push changes to remote', value: SYNC_UI.ACTIONS.PUSH },
                { name: 'Reset/discard changes', value: SYNC_UI.ACTIONS.RESET }
            ]
        );

        if (action === SYNC_UI.ACTIONS.PUSH) await this.pushPendingChanges(branchName, isInteractive);
        else if (action === SYNC_UI.ACTIONS.RESET) await this.resetLocalChanges(isInteractive);
    }

    private async resetLocalChanges(isInteractive: boolean): Promise<void> {
        this.uiFacade.clearConsole();
        this.loggerService.debug(`Reset operation. Interactive: ${isInteractive}`);
        this.uiFacade.printSectionHeader(SYNC_UI.SECTION_HEADER.RESET_CHANGES, '🔄');

        if (!(await this.checkRepositorySetup())) return;

        try {
            this.loggerService.info('Fetching changes for reset...');
            const changesResult = await this.syncCommandService.getChangesForReset();

            if (
                !changesResult.success ||
                !changesResult.data ||
                (changesResult.data.promptChanges.length === 0 && changesResult.data.fragmentChanges.length === 0)
            ) {
                this.loggerService.info(WARNING_MESSAGES.NO_CHANGES_TO_RESET);
                return;
            }

            this.displayResetableChanges(changesResult.data);
            let changesToReset: SyncChangeItem[] = [];

            if (!isInteractive) {
                this.loggerService.info('CLI mode: resetting all changes.');
                changesToReset = this.getAllChangesToReset(
                    changesResult.data.promptChanges,
                    changesResult.data.fragmentChanges
                );
            } else {
                const resetInfo = await this.promptForResetChanges(changesResult.data);

                if (!resetInfo) {
                    this.loggerService.info('Reset cancelled.');
                    return;
                }

                changesToReset = resetInfo.changesToReset;
            }

            if (changesToReset.length === 0) {
                this.loggerService.warn(WARNING_MESSAGES.NO_CHANGES_SELECTED);
                return;
            }

            await this.performResetChanges(changesToReset);
        } catch (error) {
            this.handleError(error, 'resetting local changes');
        }
    }

    private displayResetableChanges(changes: { promptChanges: any[]; fragmentChanges: any[] }): void {
        if (changes.promptChanges?.length > 0) {
            this.uiFacade.print(chalk.bold(`\nPrompt changes to reset:`));
            this.uiFacade.printSeparator();
            changes.promptChanges.forEach((c) =>
                this.uiFacade.print(`[ ] ${this.uiFacade.formatOperationType(c.type)} ${c.path.split('/')[0]}`)
            );
            this.uiFacade.printSeparator();
        }

        if (changes.fragmentChanges?.length > 0) {
            this.uiFacade.print(chalk.bold(`\nFragment changes to reset:`));
            this.uiFacade.printSeparator();
            changes.fragmentChanges.forEach((c) =>
                this.uiFacade.print(
                    `[ ] ${this.uiFacade.formatOperationType(c.type)} ${this.fragmentCommandService.getDisplayNameFromPathParts(c.path.split('/'))}`
                )
            );
            this.uiFacade.printSeparator();
        }
    }

    private async promptForResetChanges(changes: {
        promptChanges: any[];
        fragmentChanges: any[];
    }): Promise<{ changesToReset: SyncChangeItem[] } | null> {
        const resetAction = await this.selectMenu<'all' | 'select' | 'cancel'>(
            SYNC_UI.MENU.RESET_PROMPT,
            [
                { name: 'Reset all changes', value: 'all' },
                { name: 'Select specific changes to reset', value: 'select' },
                { name: 'Cancel reset operation', value: 'cancel' }
            ],
            { includeGoBack: false }
        );

        if (resetAction === 'cancel') {
            this.loggerService.warn(WARNING_MESSAGES.RESET_CANCELLED);
            return null;
        }

        let changesToReset: SyncChangeItem[] = [];

        if (resetAction === 'all')
            changesToReset = this.getAllChangesToReset(changes.promptChanges, changes.fragmentChanges);
        else if (resetAction === 'select')
            changesToReset = await this.selectSpecificChangesToReset(changes.promptChanges, changes.fragmentChanges);

        if (changesToReset.length === 0) {
            this.loggerService.warn(WARNING_MESSAGES.NO_CHANGES_SELECTED);
            return null;
        }

        const confirmReset = await this.confirmAction(`Reset ${changesToReset.length} change(s)? Cannot be undone.`);

        if (!confirmReset) {
            this.loggerService.warn(WARNING_MESSAGES.RESET_CANCELLED);
            return null;
        }
        return { changesToReset };
    }

    private getAllChangesToReset(promptChanges: any[], fragmentChanges: any[]): SyncChangeItem[] {
        const changes: SyncChangeItem[] = [];
        (promptChanges || []).forEach((c) =>
            changes.push({ type: ChangeType.PROMPT, path: c.path.split('/')[0], changeType: c.originalType || c.type })
        );
        (fragmentChanges || []).forEach((c) =>
            changes.push({
                type: ChangeType.FRAGMENT,
                path: this.fragmentCommandService.getDisplayNameFromPathParts(c.path.split('/')),
                changeType: c.originalType || c.type
            })
        );
        return changes;
    }

    private async selectSpecificChangesToReset(
        promptChanges: any[],
        fragmentChanges: any[]
    ): Promise<SyncChangeItem[]> {
        const promptChoices = (promptChanges || []).map((c) => ({
            name: `${c.type} Prompt: ${c.path.split('/')[0]}`,
            value: {
                type: ChangeType.PROMPT as 'prompt',
                path: c.path.split('/')[0],
                changeType: c.originalType || c.type
            }
        }));
        const fragmentChoices = (fragmentChanges || []).map((c) => ({
            name: `${c.type} Fragment: ${this.fragmentCommandService.getDisplayNameFromPathParts(c.path.split('/'))}`,
            value: {
                type: ChangeType.FRAGMENT as 'fragment',
                path: this.fragmentCommandService.getDisplayNameFromPathParts(c.path.split('/')),
                changeType: c.originalType || c.type
            }
        }));
        const allChoices = [...promptChoices, ...fragmentChoices];

        if (allChoices.length === 0) return [];

        this.loggerService.warn('Multi-select for reset not fully implemented yet. Resetting all changes instead.');
        return this.getAllChangesToReset(promptChanges, fragmentChanges);
    }

    private async performResetChanges(changesToReset: SyncChangeItem[]): Promise<void> {
        this.loggerService.info('Resetting selected changes...');
        this.loggerService.debug(`Resetting ${changesToReset.length} changes:`, changesToReset);
        const spinner = this.uiFacade.showSpinner(SYNC_UI.SPINNER.RESET);

        try {
            const resetResult = await this.syncCommandService.resetLocalChanges(changesToReset);

            if (resetResult.success && resetResult.data) {
                spinner.succeed();
                this.displayResetResult(resetResult.data);
            } else {
                spinner.fail('Reset failed');
                this.loggerService.error(ERROR_MESSAGES.RESET_FAILED.replace('{0}', resetResult.error || 'Unknown'));
            }
        } catch (error) {
            spinner.fail('Reset failed with exception');
            this.handleError(error, 'performing reset');
        }
    }

    private displayResetResult(resetResult: SyncResetResult): void {
        const { successCount, failCount } = resetResult;

        if (failCount === 0) {
            this.uiFacade.clearConsole();
            this.loggerService.success(SUCCESS_MESSAGES.RESET_SUCCESS, String(successCount));
            this.loggerService.info('Changes reverted. Filesystem updated, database synced.');
            this.loggerService.info(chalk.cyan('Run "npm run update-views" if needed.'));
        } else {
            this.loggerService.warn(`Reset partially succeeded: ${successCount} reset, ${failCount} failed.`);
            this.loggerService.info('See logs for details. Try reset again or manually revert.');
        }
    }

    private async pushPendingChanges(branchName: string | undefined, isInteractive: boolean): Promise<void> {
        this.uiFacade.clearConsole();
        this.loggerService.debug(`Push operation. Interactive: ${isInteractive}`);
        this.uiFacade.printSectionHeader(SYNC_UI.SECTION_HEADER.PUSH_CHANGES, '📤');

        if (!(await this.checkRepositorySetup())) return;

        this.loggerService.info('Fetching pending changes for push...');
        const pushResult = await this.syncCommandService.pushPendingChanges(branchName);

        if (!pushResult.success || !pushResult.data) {
            this.handleNoPendingChanges(pushResult.error);
            return;
        }

        await this.displayPushChanges(pushResult.data, isInteractive);
        await this.performPush(pushResult.data.branchName, isInteractive);
    }

    private async displayPushChanges(
        pushData: { changesSummary: string; branchName: string },
        isInteractive: boolean
    ): Promise<void> {
        console.log(pushData.changesSummary);
        this.loggerService.info(chalk.cyan(`\n${SYNC_UI.LABELS.BRANCH} ${pushData.branchName}`));
        let showDiff = !isInteractive;

        if (isInteractive) {
            showDiff = await this.confirmAction(INFO_MESSAGES.VIEW_DETAILED_CHANGES);
        }

        if (showDiff) {
            const spinner = this.uiFacade.showSpinner(SYNC_UI.SPINNER.DIFF);

            try {
                this.loggerService.info('Generating diff...');
                const diffResult = await this.repositoryFacade.getFormattedDiff();
                spinner.stop();

                if (!diffResult.success) this.loggerService.warn(`Failed get diff: ${diffResult.error}`);
                else if (
                    diffResult.data === WARNING_MESSAGES.NO_CHANGES ||
                    diffResult.data === 'No changes detected in prompts or fragments'
                ) {
                    this.loggerService.info('No detailed changes available.');
                } else {
                    this.loggerService.info(`\nDetailed changes:`);
                    this.uiFacade.printSeparator();
                    console.log(diffResult.data);
                    this.uiFacade.printSeparator();
                }
            } catch (error) {
                spinner.fail('Failed generate diff');
                this.handleError(error, 'generating diff');
            }
        }
    }

    private async performPush(branchName: string, isInteractive: boolean): Promise<void> {
        try {
            let commitMessage: string;

            if (isInteractive) {
                this.loggerService.info(chalk.cyan(`\n${SYNC_UI.LABELS.COMMIT_MESSAGE_HEADER}`));
                const input = await this.getInput(INFO_MESSAGES.ENTER_COMMIT_MESSAGE, { allowCancel: true });

                if (input === null) {
                    this.loggerService.warn(WARNING_MESSAGES.PUSH_CANCELLED);
                    return;
                }

                commitMessage = input || SYNC_UI.DEFAULT_COMMIT_MESSAGE(new Date().toISOString());

                if (!(await this.confirmAction(INFO_MESSAGES.CONFIRM_PUSH))) {
                    this.loggerService.warn(WARNING_MESSAGES.PUSH_CANCELLED);
                    return;
                }
            } else {
                commitMessage = SYNC_UI.DEFAULT_COMMIT_MESSAGE(new Date().toISOString());
                this.loggerService.info(`Using default commit message: ${commitMessage}`);
            }

            this.loggerService.info('Pushing changes...');
            const spinner = this.uiFacade.showSpinner(SYNC_UI.SPINNER.COMMIT);
            this.loggerService.info(`Committing and pushing to branch: ${branchName}`);
            const commitResult = await this.syncCommandService.commitAndPushChanges(branchName, commitMessage);

            if (commitResult.success) {
                spinner.succeed('Push completed successfully');
                this.loggerService.success(SUCCESS_MESSAGES.PUSH_SUCCESS);
                this.loggerService.info(chalk.bold(`${SYNC_UI.LABELS.BRANCH} ${branchName}`));
                this.loggerService.info(chalk.cyan(`${SYNC_UI.LABELS.COMMIT_MESSAGE} ${commitMessage}`));
                this.loggerService.info(INFO_MESSAGES.CREATE_PR_INSTRUCTION);
            } else {
                spinner.fail('Push failed');
                this.loggerService.error(
                    ERROR_MESSAGES.PUSH_FAILED,
                    commitResult.error || GENERIC_ERRORS.UNKNOWN_ERROR
                );
            }
        } catch (error) {
            this.handleError(error, 'performing push');
        }
    }
}
