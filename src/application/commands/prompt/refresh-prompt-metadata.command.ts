import path from 'path';

import { Inject, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { IPromptSyncRepository } from '../../../core/prompt/repositories/prompt-sync.repository.interface';
import { PromptAnalysisService } from '../../../core/prompt/services/prompt-analysis.service';
import { HashService } from '../../../infrastructure/common/services/hash.service';
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

interface IParsedRefreshOptions {
    prompt?: string;
    all?: boolean;
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'refresh-metadata',
    description: PROMPT_UI.DESCRIPTIONS.REFRESH_METADATA_COMMAND,
    aliases: ['refresh']
})
export class RefreshPromptMetadataCommand extends PromptCommandRunner {
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
        private readonly promptAnalysisService: PromptAnalysisService,
        private readonly fsService: FileSystemService,
        private readonly yamlService: YamlOperationsService,
        private readonly hashService: HashService,
        @Inject(IPromptSyncRepository)
        private readonly promptSyncRepository: IPromptSyncRepository
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

    async run(passedParams: string[], options?: IParsedRefreshOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('refresh metadata', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);

            if (opts.all) await this.refreshAllPrompts(isJsonOutput, isInteractive);
            else await this.refreshSinglePrompt(opts.prompt, isJsonOutput, isInteractive);
        });
    }

    @Option({ flags: '--prompt <promptId>', description: PROMPT_UI.OPTIONS.PROMPT_REFRESH })
    parsePrompt(val: string): string {
        return val;
    }

    @Option({ flags: '--all', description: PROMPT_UI.OPTIONS.ALL_REFRESH })
    parseAll(val: boolean): boolean {
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

    private async savePromptFilesInternal(metadata: SimplePromptMetadata, content: string): Promise<ApiResult<void>> {
        try {
            const promptDir = path.join(getConfig().PROMPTS_DIR, metadata.directory);
            const promptPath = path.join(promptDir, 'prompt.md');
            const metadataPath = path.join(promptDir, 'metadata.yml');
            const readmePath = path.join(promptDir, 'README.md');
            await this.fsService.ensureDirectory(promptDir);
            await this.fsService.writeFileContent(promptPath, content);

            if (!metadata.content_hash) {
                const hashResult = await this.hashService.generateContentHash(content);

                if (hashResult.success && hashResult.data) {
                    metadata.content_hash = hashResult.data;
                } else {
                    this.loggerService.warn('Failed to generate content hash for metadata.');
                }
            }

            const dumpResult = this.yamlService.dumpYamlContent(metadata);

            if (!dumpResult.success || dumpResult.data === undefined) {
                return Result.failure(dumpResult.error || 'Failed to dump YAML');
            }

            await this.fsService.writeFileContent(metadataPath, dumpResult.data);
            const readmeExists = await this.fsService.fileExists(readmePath);

            if (!readmeExists.success || !readmeExists.data) {
                await this.fsService.writeFileContent(
                    readmePath,
                    `# ${metadata.title}\n\n${metadata.one_line_description}\n`
                );
            }

            this.loggerService.debug('Prompt files saved successfully after refresh.');
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(
                `Failed save prompt files after refresh: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async updateDatabaseInternal(directoryName?: string): Promise<ApiResult<{ promptId: string }>> {
        try {
            const result = directoryName
                ? await this.promptSyncRepository.syncSpecificPrompt(directoryName)
                : await this.promptSyncRepository
                      .syncPromptsWithFileSystem()
                      .then(() => Result.success({ promptId: '0' }));

            if (!result.success) {
                return Result.failure(result.error || 'Failed to update database after refresh');
            }
            return Result.success(result.data ?? { promptId: '0' });
        } catch (error) {
            return Result.failure(
                `Database update error after refresh: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async refreshSinglePrompt(
        promptId: string | undefined,
        isJsonOutput: boolean,
        isInteractive: boolean
    ): Promise<void> {
        let selectedPromptId = promptId;

        if (!selectedPromptId && isInteractive) {
            const allPrompts = await this.promptFacade.getAllPrompts();

            if (!allPrompts || allPrompts.length === 0) {
                this.loggerService.warn('No prompts found to refresh.');
                return;
            }

            const promptChoices: MenuItem<CategoryItem | 'back'>[] = allPrompts.map((p) => ({
                name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} (${p.primary_category})`,
                value: p
            }));
            const selectedChoice = await this.selectMenu<CategoryItem | 'back'>(
                'Select prompt to refresh:',
                promptChoices,
                { includeGoBack: true }
            );

            if (selectedChoice === 'back') {
                this.loggerService.warn('No prompt selected');
                return;
            }

            selectedPromptId = selectedChoice.id;
        }

        if (!selectedPromptId) {
            this.handleMissingArguments(
                isJsonOutput,
                'Prompt ID/directory required.',
                'Provide --prompt or run interactively.'
            );
            return;
        }

        const promptFiles = await this.promptFacade.getPromptFiles(selectedPromptId);

        if (!promptFiles) {
            this.loggerService.error(`Failed load prompt for refresh: ${selectedPromptId}`);

            if (isJsonOutput)
                this.writeJsonResponse({ success: false, error: `Failed load prompt: ${selectedPromptId}` });
            return;
        }

        const { promptContent, metadata } = promptFiles;
        const simpleMetadata: SimplePromptMetadata = {
            title: metadata.title,
            directory: metadata.directory,
            primary_category: metadata.primary_category,
            subcategories: metadata.subcategories,
            one_line_description: metadata.one_line_description,
            description: metadata.description,
            tags:
                typeof metadata.tags === 'string'
                    ? metadata.tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                    : metadata.tags,
            variables: metadata.variables,
            content_hash: metadata.content_hash,
            fragments: metadata.fragments
        };
        const spinner = isInteractive
            ? this.uiFacade.showSpinner(`Refreshing metadata for "${metadata.title}"...`)
            : null;
        const result = await this.promptAnalysisService.refreshMetadata(simpleMetadata, promptContent);
        spinner?.stop();

        if (isJsonOutput) {
            this.writeJsonResponse({ success: result.success, error: result.error, data: result.data });
        } else if (result.success) {
            if (result.data) {
                const saveRes = await this.savePromptFilesInternal(result.data, promptContent);

                if (!saveRes.success) {
                    this.loggerService.error(`Failed to save updated metadata: ${saveRes.error}`);
                }

                const dbRes = await this.updateDatabaseInternal(metadata.directory);

                if (!dbRes.success) {
                    this.loggerService.error(`Failed to update database after refresh: ${dbRes.error}`);
                }
            }

            this.loggerService.success(PROMPT_UI.MESSAGES.REFRESH_SUCCESS.replace('{0}', metadata.title));
        } else {
            this.loggerService.error(`Failed refresh metadata: ${result.error}`);
        }

        if (isInteractive && !isJsonOutput) await this.pressKeyToContinue();
    }

    private async refreshAllPrompts(isJsonOutput: boolean, isInteractive: boolean): Promise<void> {
        const promptsResult = await this.promptFacade.getAllPrompts();

        if (!promptsResult || promptsResult.length === 0) {
            if (isJsonOutput) this.writeJsonResponse({ success: false, error: 'No prompts found' });
            else this.loggerService.warn('No prompts found');
            return;
        }

        const prompts = promptsResult;
        const results: { id: string; title: string; success: boolean; error?: string }[] = [];
        let successCount = 0;
        let failCount = 0;
        const total = prompts.length;
        let spinner: ReturnType<typeof this.uiFacade.showSpinner> | null = null;

        for (let i = 0; i < total; i++) {
            const prompt = prompts[i];
            const progress = `(${i + 1}/${total})`;

            if (isInteractive) {
                spinner?.stop();
                spinner = this.uiFacade.showSpinner(`Refreshing ${progress} ${prompt.title}...`);
            } else {
                this.loggerService.info(`Refreshing ${progress} ${prompt.title}...`);
            }

            const promptFiles = await this.promptFacade.getPromptFiles(prompt.id);

            if (!promptFiles) {
                this.loggerService.error(`Failed load files for ${prompt.title} ${progress}`);
                results.push({ id: prompt.id, title: prompt.title, success: false, error: 'Failed to load files' });
                failCount++;
                spinner?.fail(`Failed to load files for ${prompt.title}`);
                continue;
            }

            const simpleMetadata: SimplePromptMetadata = {
                title: promptFiles.metadata.title,
                directory: promptFiles.metadata.directory,
                primary_category: promptFiles.metadata.primary_category,
                subcategories: promptFiles.metadata.subcategories,
                one_line_description: promptFiles.metadata.one_line_description,
                description: promptFiles.metadata.description,
                tags:
                    typeof promptFiles.metadata.tags === 'string'
                        ? promptFiles.metadata.tags
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean)
                        : promptFiles.metadata.tags,
                variables: promptFiles.metadata.variables,
                content_hash: promptFiles.metadata.content_hash,
                fragments: promptFiles.metadata.fragments
            };
            const refreshResult = await this.promptAnalysisService.refreshMetadata(
                simpleMetadata,
                promptFiles.promptContent
            );

            if (refreshResult.success) {
                if (refreshResult.data) {
                    const saveRes = await this.savePromptFilesInternal(refreshResult.data, promptFiles.promptContent);

                    if (!saveRes.success) {
                        this.loggerService.error(
                            `Failed to save updated metadata for ${prompt.title}: ${saveRes.error}`
                        );
                        failCount++;
                        results.push({
                            id: prompt.id,
                            title: prompt.title,
                            success: false,
                            error: `Save failed: ${saveRes.error}`
                        });
                        spinner?.fail(`Failed to save ${prompt.title}`);
                        continue;
                    }

                    const dbRes = await this.updateDatabaseInternal(promptFiles.metadata.directory);

                    if (!dbRes.success) {
                        this.loggerService.error(
                            `Failed to update database for ${prompt.title} after refresh: ${dbRes.error}`
                        );
                    }
                }

                successCount++;
                results.push({ id: prompt.id, title: prompt.title, success: true });
                spinner?.succeed(`Refreshed ${prompt.title}`);
            } else {
                failCount++;
                results.push({ id: prompt.id, title: prompt.title, success: false, error: refreshResult.error });
                this.loggerService.error(`Failed refresh ${prompt.title} ${progress}: ${refreshResult.error}`);
                spinner?.fail(`Failed to refresh ${prompt.title}`);
            }
        }
        spinner?.stop();

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: true,
                data: { total, success: successCount, failed: failCount, results }
            });
        } else {
            this.loggerService.info(PROMPT_UI.MESSAGES.REFRESH_COMPLETE);
            this.loggerService.success(PROMPT_UI.MESSAGES.REFRESH_SUCCESS_COUNT.replace('{0}', String(successCount)));

            if (failCount > 0)
                this.loggerService.error(PROMPT_UI.MESSAGES.REFRESH_FAILED_COUNT.replace('{0}', String(failCount)));

            if (isInteractive) await this.pressKeyToContinue();
        }
    }
}
