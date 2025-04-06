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
import { ApiResult, Result, SimplePromptMetadata, PromptMetadata, CategoryItem, MenuItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedUpdatePromptOptions {
    prompt?: string;
    file?: string;
    content?: string;
    analyze?: boolean;
    json?: boolean;
    nonInteractive?: boolean;
}

interface UpdatePromptResponse {
    id: string;
    title: string;
    directory: string;
    updated: boolean;
}

@Injectable()
@SubCommand({
    name: 'update',
    description: PROMPT_UI.DESCRIPTIONS.UPDATE_COMMAND,
    aliases: ['edit']
})
export class UpdatePromptCommand extends PromptCommandRunner {
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
        private readonly fsService: FileSystemService,
        private readonly yamlService: YamlOperationsService,
        private readonly hashService: HashService,
        private readonly syncService: SyncCommandService,
        private readonly promptAnalysisService: PromptAnalysisService,
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

    async run(passedParams: string[], options?: IParsedUpdatePromptOptions): Promise<void> {
        const opts = options || {};
        const analyze = opts.analyze !== false;
        await this.executeWithErrorHandling('update prompt', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            let result: ApiResult<UpdatePromptResponse | null> = Result.failure('Execution mode not determined');

            if (isInteractive) {
                result = await this.executeInteractive(opts.prompt, { ...opts, analyze });
            } else {
                if (!opts.prompt) {
                    this.handleMissingArguments(
                        isJsonOutput,
                        'Prompt ID/directory required via --prompt.',
                        'Provide --prompt option.'
                    );
                    return;
                }

                result = await this.executeNonInteractive(opts.prompt, { ...opts, analyze });
            }

            if (isJsonOutput) {
                this.writeJsonResponse({ success: result.success, error: result.error, data: result.data });
            } else if (!result.success) {
                this.loggerService.error(result.error || 'Failed to update prompt');
            }
        });
    }

    @Option({ flags: '--prompt <promptId>', description: PROMPT_UI.OPTIONS.PROMPT_ID })
    parsePrompt(val: string): string {
        return val;
    }
    @Option({ flags: '--file <file>', description: PROMPT_UI.OPTIONS.FILE })
    parseFile(val: string): string {
        return val;
    }
    @Option({ flags: '--content <content>', description: PROMPT_UI.OPTIONS.CONTENT })
    parseContent(val: string): string {
        return val;
    }
    @Option({ flags: '--analyze', description: 'Analyze prompt using AI', defaultValue: true })
    parseAnalyze(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--no-analyze', description: 'Skip AI analysis' })
    parseNoAnalyze(val: boolean): boolean {
        return !val;
    }
    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async executeInteractive(
        promptIdentifier: string | undefined,
        options: { analyze?: boolean }
    ): Promise<ApiResult<UpdatePromptResponse | null>> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(PROMPT_UI.SECTION_HEADER.UPDATE, PROMPT_UI.SECTION_HEADER.UPDATE_ICON);
        let promptToUpdate = promptIdentifier;

        if (!promptToUpdate) {
            const allPrompts = await this.promptFacade.getAllPrompts();

            if (!allPrompts || allPrompts.length === 0) {
                this.loggerService.warn('No prompts found to update.');
                return Result.failure('No prompts available to update');
            }

            const promptChoices: MenuItem<CategoryItem | 'back'>[] = allPrompts.map((p) => ({
                name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} (${p.primary_category})`,
                value: p
            }));
            const selectedChoice = await this.selectMenu<CategoryItem | 'back'>(
                'Select prompt to update:',
                promptChoices,
                { includeGoBack: true }
            );

            if (selectedChoice === 'back') return Result.failure('No prompt selected');

            promptToUpdate = selectedChoice.id;
        }

        if (!promptToUpdate) {
            return Result.failure('Prompt identifier could not be determined.');
        }

        const promptFiles = await this.promptFacade.getPromptFiles(promptToUpdate);

        if (!promptFiles) return Result.failure('Failed load prompt for updating');

        const { promptContent, metadata } = promptFiles;
        this.loggerService.info(`Updating prompt: ${metadata.title}`);
        const updatedContent = await this.getMultilineInput(PROMPT_UI.INPUT.EDIT_CONTENT, promptContent, {
            instructionMessage: 'Editor opening...'
        });
        const contentChanged = updatedContent !== promptContent;

        if (!contentChanged) {
            this.loggerService.info(PROMPT_UI.MESSAGES.NO_CHANGES);
            await this.pressKeyToContinue();
            return Result.success({
                id: metadata.id || '0',
                title: metadata.title,
                directory: metadata.directory,
                updated: false
            });
        }

        const result = await this.completePromptUpdate(metadata, updatedContent, options.analyze !== false, true);

        if (!result.success) {
            return Result.failure(result.error || 'Failed to update prompt', {
                data: { id: metadata.id || '0', title: metadata.title, directory: metadata.directory, updated: false }
            });
        }

        await this.pressKeyToContinue();
        return Result.success({
            id: metadata.id || '0',
            title: metadata.title,
            directory: metadata.directory,
            updated: true
        });
    }

    private async executeNonInteractive(
        promptIdentifier: string,
        options: { file?: string; content?: string; analyze?: boolean }
    ): Promise<ApiResult<UpdatePromptResponse | null>> {
        const promptFiles = await this.promptFacade.getPromptFiles(promptIdentifier);

        if (!promptFiles) return Result.failure(`Prompt not found: ${promptIdentifier}`);

        const { metadata, promptContent: currentContent } = promptFiles;
        let newContent: string;

        if (options.file) {
            const fileExistsResult = await this.fsService.fileExists(options.file);

            if (!fileExistsResult.success || !fileExistsResult.data)
                return Result.failure(`File not found: ${options.file}`);

            const contentResult = await this.fsService.readFileContent(options.file);

            if (!contentResult.success || !contentResult.data)
                return Result.failure(contentResult.error || `Failed read file: ${options.file}`);

            newContent = contentResult.data;
        } else if (options.content) {
            newContent = options.content;
        } else {
            return Result.failure('New content required (--file or --content)');
        }

        const contentChanged = newContent !== currentContent;

        if (!contentChanged) {
            return Result.success({
                id: metadata.id || '0',
                title: metadata.title,
                directory: metadata.directory,
                updated: false
            });
        }

        const result = await this.completePromptUpdate(metadata, newContent, options.analyze !== false, false);

        if (!result.success) {
            return Result.failure(result.error || 'Failed to update prompt', {
                data: { id: metadata.id || '0', title: metadata.title, directory: metadata.directory, updated: false }
            });
        }
        return Result.success({
            id: metadata.id || '0',
            title: metadata.title,
            directory: metadata.directory,
            updated: true
        });
    }

    private async savePromptFiles(metadata: SimplePromptMetadata, content: string): Promise<ApiResult<void>> {
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

            this.loggerService.debug('Prompt files saved successfully');
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(
                `Failed save prompt files: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async updateDatabase(directoryName?: string): Promise<ApiResult<{ promptId: string }>> {
        try {
            const result = directoryName
                ? await this.promptSyncRepository.syncSpecificPrompt(directoryName)
                : await this.promptSyncRepository
                      .syncPromptsWithFileSystem()
                      .then(() => Result.success({ promptId: '0' }));

            if (!result.success) {
                return Result.failure(result.error || 'Failed to update database');
            }
            return Result.success(result.data ?? { promptId: '0' });
        } catch (error) {
            return Result.failure(`Database update error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async offerRemoteSync(): Promise<ApiResult<boolean>> {
        return this.syncService.offerRemoteSync();
    }

    private async completePromptUpdate(
        metadata: PromptMetadata,
        newContent: string,
        analyze: boolean = true,
        isInteractive: boolean = true
    ): Promise<ApiResult<void>> {
        try {
            let simpleMetadataForProcessing: SimplePromptMetadata = {
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

            if (analyze) {
                this.loggerService.debug('Analyzing updated prompt content...');
                const spinner = isInteractive ? this.uiFacade.showSpinner('Analyzing prompt...') : null;

                try {
                    const analysisResult = await this.promptAnalysisService.analyzePrompt(
                        simpleMetadataForProcessing,
                        newContent
                    );

                    if (analysisResult.success && analysisResult.data) {
                        simpleMetadataForProcessing = analysisResult.data;
                        spinner?.succeed('Analysis complete.');
                    } else {
                        spinner?.fail('AI analysis failed.');
                        this.loggerService.warn('AI analysis failed, using existing metadata structure.');
                    }
                    // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_error) {
                    spinner?.fail('AI analysis failed.');
                    this.loggerService.warn('AI analysis failed, using existing metadata structure.');
                }
            } else {
                const hashResult = await this.hashService.generateContentHash(newContent);

                if (hashResult.success && hashResult.data) simpleMetadataForProcessing.content_hash = hashResult.data;
            }

            const saveResult = await this.savePromptFiles(simpleMetadataForProcessing, newContent);

            if (!saveResult.success) return Result.failure(saveResult.error || 'Failed save prompt');

            await this.updateDatabase(metadata.directory);
            this.loggerService.success(
                PROMPT_UI.MESSAGES.PROMPT_UPDATED.replace('{0}', simpleMetadataForProcessing.title)
            );
            this.loggerService.info(
                PROMPT_UI.MESSAGES.PROMPT_LOCATION.replace(
                    '{0}',
                    path.join(getConfig().PROMPTS_DIR, metadata.directory)
                )
            );

            if (isInteractive) await this.offerRemoteSync();
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Error completing update: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
