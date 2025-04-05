import path from 'path';

import { Inject, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { IPromptSyncRepository } from '../../../core/prompt/repositories/prompt-sync.repository.interface';
import { IPromptRepository } from '../../../core/prompt/repositories/prompt.repository.interface';
import { YamlOperationsService } from '../../../infrastructure/common/services/yaml-operations.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { FileSystemService } from '../../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { getConfig } from '../../../shared/config';
import { PROMPT_UI } from '../../../shared/constants';
import { ApiResult, Result, SimplePromptMetadata, CategoryItem, MenuItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedDeletePromptOptions {
    prompt?: string;
    force?: boolean;
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'delete',
    description: PROMPT_UI.DESCRIPTIONS.DELETE_COMMAND
})
export class DeletePromptCommand extends PromptCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        promptFacade: PromptFacade,
        executionFacade: ExecutionFacade,
        variableFacade: VariableFacade,
        conversationFacade: ConversationFacade,
        promptInteractionService: PromptInteractionService,
        private readonly syncService: SyncCommandService,
        @Inject(IPromptRepository)
        private readonly promptRepo: IPromptRepository,
        @Inject(IPromptSyncRepository)
        private readonly promptSyncRepo: IPromptSyncRepository,
        private readonly fsService: FileSystemService,
        private readonly yamlService: YamlOperationsService
    ) {
        super(
            uiFacade,
            errorService,
            repositoryService,
            loggerService,
            promptFacade,
            executionFacade,
            variableFacade,
            conversationFacade,
            promptInteractionService
        );
    }

    async run(passedParams: string[], options?: IParsedDeletePromptOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('delete prompt', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);

            if (isInteractive && !isJsonOutput) {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader('Delete Prompt', '🔥');
            }

            let promptIdentifier = opts.prompt;
            let promptTitle = 'Unknown';
            let promptDir = 'Unknown';
            let promptId: string | undefined;

            if (opts.force && promptIdentifier && /^\d+$/.test(promptIdentifier)) {
                const result = await this.deletePromptInternal(promptIdentifier, promptTitle, promptIdentifier);

                if (isJsonOutput)
                    this.writeJsonResponse({
                        success: result.success,
                        error: result.error,
                        data: {
                            id: promptIdentifier,
                            title: result.data?.title ?? promptTitle,
                            directory: result.data?.directory ?? 'unknown'
                        }
                    });
                else if (result.success)
                    this.loggerService.success(`Successfully deleted prompt ID ${promptIdentifier}`);
                else this.loggerService.error(`Failed delete prompt ID ${promptIdentifier}: ${result.error}`);
                return;
            }

            if (!promptIdentifier && isInteractive) {
                const allPromptsResult = await this.promptFacade.getAllPrompts();

                if (!allPromptsResult || allPromptsResult.length === 0) {
                    this.loggerService.warn('No prompts found to delete.');
                    return;
                }

                const promptChoices: MenuItem<CategoryItem | 'back'>[] = allPromptsResult.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} (${p.primary_category})`,
                    value: p
                }));
                const selectedChoice = await this.selectMenu<CategoryItem | 'back'>(
                    'Select prompt to delete:',
                    promptChoices,
                    { includeGoBack: true }
                );

                if (selectedChoice === 'back') {
                    if (isJsonOutput) this.writeJsonResponse({ success: false, error: 'No prompt selected' });
                    else this.loggerService.warn('No prompt selected. Exiting.');
                    return;
                }

                promptIdentifier = selectedChoice.id;
                promptTitle = selectedChoice.title;
                promptDir = selectedChoice.path;
                promptId = selectedChoice.id;
                this.loggerService.info(`Selected prompt: "${promptTitle}" (ID: ${promptId})`);
            } else if (!promptIdentifier) {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Prompt ID/directory required via --prompt.',
                    'Provide --prompt option.'
                );
                return;
            }

            if (!promptIdentifier) {
                this.loggerService.error('Internal error: Prompt identifier is unexpectedly undefined.');
                return;
            }

            const details = await this.promptFacade.getPromptDetails(promptIdentifier);

            if (details) {
                promptId = details.id;
                promptDir = details.directory;
                promptTitle = details.title;
            } else {
                this.loggerService.warn(
                    `Could not fetch details for prompt identifier "${promptIdentifier}", proceeding with deletion attempt.`
                );

                if (/^\d+$/.test(promptIdentifier)) {
                    promptId = promptIdentifier;
                    promptDir = 'unknown-dir';
                } else {
                    promptDir = promptIdentifier;
                    promptId = 'unknown-id';
                }
            }

            let confirmed = opts.force ?? false;

            if (!confirmed && isInteractive) {
                this.loggerService.warn('This action cannot be undone.');
                confirmed = await this.confirmAction(
                    `Are you sure you want to delete prompt "${promptTitle}" (Dir: ${promptDir})?`,
                    { default: false }
                );
            }

            if (!confirmed) {
                if (isJsonOutput) this.writeJsonResponse({ success: false, error: 'Deletion cancelled' });
                else this.loggerService.info('Deletion cancelled.');
                return;
            }

            const result = await this.deletePromptInternal(promptDir, promptTitle, promptId);

            if (isJsonOutput) {
                this.writeJsonResponse({
                    success: result.success,
                    error: result.error,
                    data: result.success
                        ? { id: promptId ?? 'unknown', title: result.data?.title ?? promptTitle, directory: promptDir }
                        : null
                });
            } else if (result.success) {
                this.loggerService.success(`Prompt "${result.data?.title ?? promptTitle}" deleted successfully.`);

                if (isInteractive) await this.syncService.offerRemoteSync();
            } else {
                this.loggerService.error(result.error || 'Failed to delete prompt');
            }
        });
    }

    private async deletePromptInternal(
        promptDir: string,
        knownTitle: string,
        knownId?: string
    ): Promise<ApiResult<SimplePromptMetadata>> {
        try {
            const promptPath = path.join(getConfig().PROMPTS_DIR, promptDir);
            this.loggerService.info(`Starting deletion of prompt: ${promptDir}`);
            const existsResult = await this.fsService.fileExists(promptPath);
            let promptData: SimplePromptMetadata = { directory: promptDir, title: knownTitle };

            if (existsResult.success && existsResult.data) {
                const metadataPath = path.join(promptPath, 'metadata.yml');
                const metaExists = await this.fsService.fileExists(metadataPath);

                if (metaExists.success && metaExists.data) {
                    const metaContent = await this.fsService.readFileContent(metadataPath);

                    if (metaContent.success && metaContent.data) {
                        const parseResult = this.yamlService.parseYamlContent(metaContent.data);

                        if (parseResult.success && parseResult.data) {
                            promptData = parseResult.data as SimplePromptMetadata;
                            promptData.directory = promptDir;
                        } else {
                            this.loggerService.warn(`Could not parse metadata for ${promptDir}: ${parseResult.error}`);
                        }
                    }
                }
            } else {
                this.loggerService.warn(`Prompt dir ${promptDir} not found on FS.`);

                if (knownId && knownId !== 'unknown-id') {
                    const dbDeleteResult = await this.promptSyncRepo.removePromptFromDatabase(knownId);

                    if (dbDeleteResult)
                        this.loggerService.info(`Removed DB entry for missing dir/prompt ID: ${knownId}`);
                }

                if (knownId === 'unknown-id' && promptDir !== 'unknown-dir') {
                    return Result.failure(`Prompt directory ${promptDir} not found.`);
                }
            }

            this.loggerService.info(`Removing prompt "${promptDir}" (ID: ${knownId ?? 'unknown'}) from database first`);
            const identifierToDelete = knownId && knownId !== 'unknown-id' ? knownId : promptDir;
            const deleteDbResult = await this.promptRepo.deletePrompt(identifierToDelete);

            if (!deleteDbResult.success) {
                this.loggerService.warn(
                    `Failed remove prompt "${identifierToDelete}" from DB, continuing FS deletion: ${deleteDbResult.error}`
                );
            } else {
                this.loggerService.info(`Successfully removed prompt "${identifierToDelete}" from database`);
            }

            if (existsResult.success && existsResult.data) {
                this.loggerService.info(`Deleting prompt directory ${promptPath}`);
                const removeDirResult = await this.fsService.removeDirectory(promptPath);

                if (!removeDirResult.success) {
                    this.loggerService.error(`Failed remove directory ${promptDir}: ${removeDirResult.error}`);
                }
            }

            this.loggerService.info(`Running cleanup for orphaned DB entries`);
            await this.promptSyncRepo.syncPromptsWithFileSystem();
            return Result.success(promptData);
        } catch (error) {
            this.loggerService.error(`Error in deletePromptInternal: ${error}`);
            return Result.failure(`Failed to delete prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    @Option({ flags: '--prompt <promptId>', description: PROMPT_UI.OPTIONS.PROMPT_ID })
    parsePrompt(val: string): string {
        return val;
    }

    @Option({ flags: '--force', description: PROMPT_UI.OPTIONS.FORCE })
    parseForce(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }
}
