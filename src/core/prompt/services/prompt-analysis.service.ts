import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { processPromptContent, extractVariablesFromPrompt, updatePromptWithVariables } from './prompt-processing';
import { HashService } from '../../../infrastructure/common/services/hash.service';
import { YamlOperationsService } from '../../../infrastructure/common/services/yaml-operations.service';
import { ErrorService, AppError } from '../../../infrastructure/error/services/error.service';
import { readFileContent } from '../../../infrastructure/file-system/utils/file-system.utils';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { appConfig } from '../../../shared/config';
import { SimplePromptMetadata, ApiResult, Result, PromptMetadata } from '../../../shared/types';
import { AIClient, AI_CLIENT_TOKEN } from '../../../shared/types/infrastructure';
import { FragmentService } from '../../fragment/services/fragment.service';

@Injectable({ scope: Scope.DEFAULT })
export class PromptAnalysisService {
    constructor(
        private readonly hashService: HashService,
        private readonly yamlOperationsService: YamlOperationsService,
        @Inject(AI_CLIENT_TOKEN) private readonly aiClient: AIClient,
        private readonly fragmentService: FragmentService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    private async loadAnalyzerPrompt(): Promise<string> {
        try {
            this.loggerService.info(`Loading analyzer prompt from ${appConfig.ANALYZER_PROMPT_PATH}`);
            const content = await readFileContent(appConfig.ANALYZER_PROMPT_PATH);
            this.loggerService.info(`Analyzer prompt loaded, length: ${content.length} characters`);
            return content;
        } catch (error) {
            this.loggerService.error('Error loading analyzer prompt:', error);
            throw error;
        }
    }

    private extractOutputContent(content: string): string {
        const outputStart = content.indexOf('<output>');
        const outputEnd = content.indexOf('</output>');

        if (outputStart === -1 || outputEnd === -1) {
            this.loggerService.warn('Output tags not found in content, returning trimmed content');
            return content.trim();
        }
        return content.slice(outputStart + 8, outputEnd).trim();
    }

    private isValidMetadata(metadata: PromptMetadata): boolean {
        if (!metadata.title || !metadata.primary_category) {
            this.loggerService.warn('Missing required fields in metadata: title, primary_category');
            return false;
        }

        if (metadata.variables && !Array.isArray(metadata.variables)) {
            this.loggerService.warn('Metadata "variables" field exists but is not an array');
            return false;
        }
        return true;
    }

    private async processMetadataGeneration(promptContent: string): Promise<PromptMetadata> {
        this.loggerService.info('Processing prompt for metadata generation');

        try {
            const [analyzerPrompt, availableFragmentsResult] = await Promise.all([
                this.loadAnalyzerPrompt(),
                this.fragmentService.listAvailableFragments()
            ]);
            const availableFragmentsJson = availableFragmentsResult.success
                ? (availableFragmentsResult.data ?? '{}')
                : '{}';
            const variables = {
                PROMPT_TO_ANALYZE: promptContent,
                AVAILABLE_PROMPT_FRAGMENTS: availableFragmentsJson
            };
            const updatedPromptContent = updatePromptWithVariables(analyzerPrompt, variables, this.loggerService);
            const rawAiContent = await processPromptContent(
                [{ role: 'user', content: updatedPromptContent }],
                false,
                this.aiClient,
                false,
                this.errorService,
                this.loggerService
            );
            const yamlContent = this.extractOutputContent(rawAiContent);
            const parseResult = this.yamlOperationsService.parseYamlContent(yamlContent);

            if (!parseResult.success || !parseResult.data)
                throw new Error(`Failed to parse YAML: ${parseResult.error}`);

            if (typeof parseResult.data !== 'object' || parseResult.data === null)
                throw new Error('Generated metadata not object.');

            const parsedMetadata = parseResult.data as Partial<PromptMetadata>;
            const metadata: PromptMetadata = {
                id: undefined,
                title: parsedMetadata.title || '',
                primary_category: parsedMetadata.primary_category || 'uncategorized',
                subcategories: Array.isArray(parsedMetadata.subcategories) ? parsedMetadata.subcategories : [],
                directory: parsedMetadata.directory || '',
                tags: Array.isArray(parsedMetadata.tags)
                    ? parsedMetadata.tags
                    : typeof parsedMetadata.tags === 'string'
                      ? [parsedMetadata.tags]
                      : [],
                one_line_description: parsedMetadata.one_line_description || '',
                description: parsedMetadata.description || '',
                variables: Array.isArray(parsedMetadata.variables) ? parsedMetadata.variables : [],
                content_hash: parsedMetadata.content_hash,
                fragments: Array.isArray(parsedMetadata.fragments) ? parsedMetadata.fragments : []
            };

            if (!this.isValidMetadata(metadata)) throw new Error('Invalid metadata generated.');

            this.loggerService.info('Metadata generation processed successfully.');
            return metadata;
        } catch (error) {
            this.loggerService.error('Error in processMetadataGeneration:', error);
            throw error;
        }
    }

    async analyzePrompt(
        metadata: SimplePromptMetadata,
        content: string,
        options: { preserveExisting?: boolean; regenerateHash?: boolean } = {}
    ): Promise<ApiResult<SimplePromptMetadata>> {
        this.loggerService.debug(`Analyzing prompt: "${metadata.title || 'Untitled'}"`);

        try {
            const preserveExisting = options.preserveExisting !== false;
            const regenerateHash = options.regenerateHash !== false;
            const extractedVariables = extractVariablesFromPrompt(content);
            this.loggerService.debug(`Extracted ${extractedVariables.length} variables.`);
            let contentHash = metadata.content_hash || '';

            if (regenerateHash) {
                const hashResult = await this.hashService.generateContentHash(content);

                if (!hashResult.success || hashResult.data === undefined) {
                    throw new Error(`Failed to generate content hash: ${hashResult.error}`);
                }

                contentHash = hashResult.data;
                this.loggerService.debug(`Generated content hash: ${contentHash}`);
            }

            this.loggerService.debug('Calling AI for metadata analysis...');
            const analyzedMetadata = await this.processMetadataGeneration(content);
            this.loggerService.debug('AI analysis completed.');

            const analyzedTags = Array.isArray(analyzedMetadata.tags)
                ? analyzedMetadata.tags
                : typeof analyzedMetadata.tags === 'string'
                  ? [analyzedMetadata.tags]
                  : [];
            const existingTags = Array.isArray(metadata.tags)
                ? metadata.tags
                : typeof metadata.tags === 'string'
                  ? [metadata.tags]
                  : [];
            const mergedMetadata: SimplePromptMetadata = {
                directory: metadata.directory,
                title: preserveExisting ? metadata.title || analyzedMetadata.title : analyzedMetadata.title,
                primary_category: preserveExisting
                    ? metadata.primary_category || analyzedMetadata.primary_category
                    : analyzedMetadata.primary_category,
                one_line_description: preserveExisting
                    ? metadata.one_line_description || analyzedMetadata.one_line_description
                    : analyzedMetadata.one_line_description,
                description: preserveExisting
                    ? metadata.description || analyzedMetadata.description
                    : analyzedMetadata.description,
                subcategories: preserveExisting
                    ? metadata.subcategories && metadata.subcategories.length > 0
                        ? metadata.subcategories
                        : analyzedMetadata.subcategories
                    : analyzedMetadata.subcategories,
                tags: preserveExisting ? (existingTags.length > 0 ? existingTags : analyzedTags) : analyzedTags,
                fragments: preserveExisting
                    ? metadata.fragments || analyzedMetadata.fragments
                    : analyzedMetadata.fragments,
                variables: extractedVariables,
                content_hash: contentHash
            };

            if (!mergedMetadata.title || !mergedMetadata.primary_category) {
                this.loggerService.warn('Merged metadata is missing title or primary_category.');
            }

            this.loggerService.debug('Metadata merged successfully.');
            return Result.success(mergedMetadata);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('ANALYSIS_ERROR', `Failed prompt analysis: ${message}`),
                'PromptAnalysisService.analyzePrompt'
            );
            return Result.failure(`Failed to analyze prompt: ${message}`);
        }
    }

    async refreshMetadata(metadata: SimplePromptMetadata, content: string): Promise<ApiResult<SimplePromptMetadata>> {
        this.loggerService.debug(`Refreshing metadata for prompt: "${metadata.title || metadata.directory}"`);
        return this.analyzePrompt(metadata, content, {
            preserveExisting: false,
            regenerateHash: true
        });
    }
}
