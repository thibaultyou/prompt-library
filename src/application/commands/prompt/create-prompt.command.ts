import path from 'path';

import { Inject, Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { IPromptSyncRepository } from '../../../core/prompt/repositories/prompt-sync.repository.interface';
import { PromptAnalysisService } from '../../../core/prompt/services/prompt-analysis.service';
import { HashService } from '../../../infrastructure/common/services/hash.service';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { YamlOperationsService } from '../../../infrastructure/common/services/yaml-operations.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { FileSystemService } from '../../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { getConfig } from '../../../shared/config';
import { PROMPT_UI } from '../../../shared/constants';
import { ApiResult, SimplePromptMetadata, Result } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedCreatePromptOptions {
    directory?: string;
    title?: string;
    category?: string;
    description?: string;
    file?: string;
    content?: string;
    analyze?: boolean;
    json?: boolean;
    nonInteractive?: boolean;
}

interface CreatePromptResponse {
    id: string;
    title: string;
    directory: string;
}

@Injectable()
@SubCommand({
    name: 'create',
    description: PROMPT_UI.DESCRIPTIONS.CREATE_COMMAND
})
export class CreatePromptCommand extends PromptCommandRunner {
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
        private readonly stringFormatterService: StringFormatterService,
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

    async run(passedParams: string[], options?: IParsedCreatePromptOptions): Promise<void> {
        const opts = options || {};
        const analyze = opts.analyze !== false;
        await this.executeWithErrorHandling('create prompt', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            let result: ApiResult<CreatePromptResponse | null> = Result.failure('Execution mode not determined');

            if (isInteractive) {
                result = await this.executeInteractive({ ...opts, analyze });
            } else {
                result = await this.executeNonInteractive({ ...opts, analyze });
            }

            if (isJsonOutput) {
                this.writeJsonResponse({ success: result.success, error: result.error, data: result.data });
            } else if (!result.success) {
                this.loggerService.error(result.error || 'Failed to create prompt');
            }
        });
    }

    @Option({ flags: '--directory <directory>', description: PROMPT_UI.OPTIONS.DIRECTORY })
    parseDirectory(val: string): string {
        return val;
    }
    @Option({ flags: '--title <title>', description: PROMPT_UI.OPTIONS.TITLE })
    parseTitle(val: string): string {
        return val;
    }
    @Option({ flags: '--category <category>', description: PROMPT_UI.OPTIONS.CATEGORY })
    parseCategory(val: string): string {
        return val;
    }
    @Option({ flags: '--description <description>', description: PROMPT_UI.OPTIONS.DESCRIPTION })
    parseDescription(val: string): string {
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
        options: {
            directory?: string;
            title?: string;
            category?: string;
            description?: string;
            analyze?: boolean;
        } = {}
    ): Promise<ApiResult<CreatePromptResponse | null>> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Create New Prompt', '🌱');
            const titleInput =
                options.title ||
                (await this.getInput('Enter prompt title:', {
                    default: PROMPT_UI.TEMPLATE.DEFAULT_TITLE,
                    allowCancel: true
                }));

            if (titleInput === null) return Result.failure('Creation cancelled');

            const title = titleInput;
            const defaultDir = this.stringFormatterService.formatSnakeCase(title.toLowerCase());
            const directoryInput =
                options.directory ||
                (await this.getInput('Enter directory name:', { default: defaultDir, allowCancel: true }));

            if (directoryInput === null) return Result.failure('Creation cancelled');

            const directory = directoryInput;
            const category = options.category || (await this.selectCategory());

            if (!category) return Result.failure('Category selection cancelled');

            const descriptionInput =
                options.description || (await this.getInput('Enter one-line description:', { allowCancel: true }));

            if (descriptionInput === null) return Result.failure('Creation cancelled');

            const description = descriptionInput;
            const metadataResult = await this.createInitialMetadata(title, directory, category, description);

            if (!metadataResult.success || !metadataResult.data)
                return Result.failure(metadataResult.error || 'Failed create metadata');

            const templateContent = this.getTemplateContent(title, description);
            const promptContent = await this.getMultilineInput('Edit prompt content:', templateContent, {
                instructionMessage: 'Editor opening...'
            });
            const createResult = await this.completePromptCreation(
                metadataResult.data,
                promptContent,
                directory,
                title,
                options.analyze !== false,
                true
            );

            if (!createResult.success) return Result.failure(createResult.error || 'Failed to create prompt');

            await this.pressKeyToContinue();
            return Result.success({ id: createResult.data?.promptId || '0', title, directory });
        } catch (error) {
            return Result.failure(
                `Failed create prompt interactively: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async executeNonInteractive(
        options: {
            directory?: string;
            title?: string;
            category?: string;
            description?: string;
            file?: string;
            content?: string;
            analyze?: boolean;
        } = {}
    ): Promise<ApiResult<CreatePromptResponse | null>> {
        const title = options.title;
        const category = options.category;
        const description = options.description;

        if (!title) return Result.failure('Title required (--title)');

        if (!category) return Result.failure('Category required (--category)');

        if (!description) return Result.failure('Description required (--description)');

        let promptContent = '';

        if (options.file) {
            const fileExistsResult = await this.fsService.fileExists(options.file);

            if (!fileExistsResult.success || !fileExistsResult.data)
                return Result.failure(`File not found: ${options.file}`);

            const contentResult = await this.fsService.readFileContent(options.file);

            if (!contentResult.success || !contentResult.data)
                return Result.failure(contentResult.error || `Failed read file: ${options.file}`);

            promptContent = contentResult.data;
        } else if (options.content) {
            promptContent = options.content;
        } else {
            return Result.failure('Either --file or --content required');
        }

        const directory = options.directory || this.stringFormatterService.formatSnakeCase(title.toLowerCase());

        if (!directory) return Result.failure('Could not determine directory name.');

        const metadataResult = await this.createInitialMetadata(title, directory, category, description);

        if (!metadataResult.success || !metadataResult.data)
            return Result.failure(metadataResult.error || 'Failed create metadata');

        const result = await this.completePromptCreation(
            metadataResult.data,
            promptContent,
            directory,
            title,
            options.analyze !== false,
            false
        );

        if (!result.success) return Result.failure(result.error || 'Failed to create prompt');
        return Result.success({ id: result.data?.promptId || '0', title: title, directory });
    }

    private async createInitialMetadata(
        title: string,
        directory: string,
        primaryCategory: string,
        oneLineDescription: string
    ): Promise<ApiResult<SimplePromptMetadata>> {
        try {
            if (!title || !directory || !primaryCategory || !oneLineDescription) {
                return Result.failure('All fields required for initial metadata');
            }

            const formattedDirectory = this.stringFormatterService.formatSnakeCase(directory);
            const metadata: SimplePromptMetadata = {
                title,
                directory: formattedDirectory,
                primary_category: primaryCategory,
                subcategories: [],
                one_line_description: oneLineDescription,
                description: '',
                tags: [],
                variables: [],
                content_hash: ''
            };
            return Result.success(metadata);
        } catch (error) {
            return Result.failure(
                `Failed create initial metadata: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private getTemplateContent(title: string, description: string): string {
        return `# ${title}

## Description
${description}

## Instructions
Enter instructions here.

## Expected Output
Enter output description here.

## Input parameters
some_variable - Some user input description

## User Input
Use the following syntax to avoid errors:
<user_input>
    <some_variable>{{SOME_VARIABLE}}</some_variable>
</user_input>
`;
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

    private async completePromptCreation(
        metadata: SimplePromptMetadata,
        promptContent: string,
        directory: string,
        title: string,
        analyze: boolean = true,
        isInteractive: boolean = true
    ): Promise<ApiResult<{ promptId: string }>> {
        try {
            const saveResult = await this.savePromptFiles(metadata, promptContent);

            if (!saveResult.success) return Result.failure(saveResult.error || 'Failed save prompt');

            const dbResult = await this.updateDatabase(directory);

            if (!dbResult.success) return Result.failure(dbResult.error || 'Failed update database');

            const promptId = dbResult.data?.promptId || '0';

            if (analyze) {
                try {
                    if (isInteractive) this.uiFacade.clearConsole();

                    const spinner = isInteractive ? this.uiFacade.showSpinner('Analyzing prompt...') : null;
                    const analysisResult = await this.promptAnalysisService.analyzePrompt(metadata, promptContent);

                    if (analysisResult.success && analysisResult.data) {
                        await this.savePromptFiles(analysisResult.data, promptContent);
                        await this.updateDatabase(directory);
                        spinner?.succeed('Analysis complete, metadata updated.');
                    } else {
                        spinner?.fail('AI analysis failed.');
                        this.loggerService.warn('AI analysis failed, using basic metadata.');
                    }
                } catch (error) {
                    this.loggerService.warn('AI analysis failed, using basic metadata.');
                }
            }

            this.loggerService.success(`Prompt "${title}" created successfully`);
            this.loggerService.info(`Located at: ${path.join(getConfig().PROMPTS_DIR, directory)}`);

            if (isInteractive) await this.offerRemoteSync();
            return Result.success({ promptId });
        } catch (error) {
            return Result.failure(
                `Error completing creation: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async selectCategory(): Promise<string | null> {
        try {
            const categories = this.promptFacade.getCategoryOptions();
            const choices = categories.map((cat) => ({
                name: cat.description ? `${cat.name} - ${cat.description}` : cat.name,
                value: cat.value
            }));
            const selection = await this.selectMenu<string | 'back'>('Select primary category:', choices);
            return selection === 'back' ? null : selection;
        } catch (error) {
            this.loggerService.error('Failed load categories');
            return await this.getInput('Enter primary category:', { allowCancel: true });
        }
    }
}
