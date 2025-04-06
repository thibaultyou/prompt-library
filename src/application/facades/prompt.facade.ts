import { Injectable, Scope, Inject } from '@nestjs/common';

import { IFragmentRepository } from '../../core/fragment/repositories/fragment.repository.interface';
import { IPromptExecutionRepository } from '../../core/prompt/repositories/prompt-execution.repository.interface';
import { IPromptFavoriteRepository } from '../../core/prompt/repositories/prompt-favorite.repository.interface';
import { IPromptMetadataRepository } from '../../core/prompt/repositories/prompt-metadata.repository.interface';
import { IPromptSyncRepository } from '../../core/prompt/repositories/prompt-sync.repository.interface';
import { IPromptRepository } from '../../core/prompt/repositories/prompt.repository.interface';
import { CategoryService } from '../../core/prompt/services/category.service';
import { PromptAnalysisService } from '../../core/prompt/services/prompt-analysis.service';
import { PromptService } from '../../core/prompt/services/prompt.service';
import { IVariableRepository } from '../../core/variable/repositories/variable.repository.interface';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import {
    ApiResult,
    PromptMetadata,
    CategoryItem,
    PromptVariable,
    TableFormatOptions,
    TableFormatResult,
    StyleType,
    SimplePromptMetadata,
    EnvVariable,
    PromptFragment,
    MenuItem
} from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class PromptFacade {
    constructor(
        private readonly promptService: PromptService,
        private readonly categoryService: CategoryService,
        private readonly promptAnalysisService: PromptAnalysisService,
        @Inject(IPromptRepository) private readonly promptRepository: IPromptRepository,
        @Inject(IPromptMetadataRepository) private readonly promptMetadataRepository: IPromptMetadataRepository,
        @Inject(IPromptExecutionRepository) private readonly promptExecutionRepository: IPromptExecutionRepository,
        @Inject(IPromptFavoriteRepository) private readonly promptFavoriteRepository: IPromptFavoriteRepository,
        @Inject(IPromptSyncRepository) private readonly promptSyncRepository: IPromptSyncRepository,
        @Inject(IFragmentRepository) private readonly fragmentRepository: IFragmentRepository,
        @Inject(IVariableRepository) private readonly variableRepository: IVariableRepository,
        private readonly loggerService: LoggerService,
        private readonly uiFacade: UiFacade,
        private readonly textFormatter: TextFormatter
    ) {}

    async getPromptById(id: number | string): Promise<ApiResult<PromptMetadata | null>> {
        return this.promptMetadataRepository.getPromptMetadata(String(id));
    }

    async getAllPromptsByCategory(): Promise<Record<string, CategoryItem[]>> {
        const result = await this.promptService.getCategories();
        return result.success && result.data ? result.data : {};
    }

    async getAllPrompts(): Promise<CategoryItem[]> {
        const result = await this.promptService.getAllPrompts();
        return result.success && result.data ? result.data : [];
    }

    async searchPrompts(keyword: string): Promise<CategoryItem[]> {
        const result = await this.promptService.searchPrompts(keyword);
        // eslint-disable-next-line unused-imports/no-unused-vars
        return result.success && result.data ? result.data.map(({ matchScore, ...item }) => item) : [];
    }

    async getPromptsSortedById(): Promise<CategoryItem[]> {
        const result = await this.promptService.getPromptsSortedById();
        return result.success && result.data ? result.data : [];
    }

    async getRecentPrompts(limit: number = 10): Promise<any[]> {
        const result = await this.promptExecutionRepository.getRecentExecutions(limit);
        return result.success && result.data ? result.data : [];
    }

    async getFavoritePrompts(): Promise<CategoryItem[]> {
        const result = await this.promptFavoriteRepository.getFavorites();

        if (!result.success || !result.data) return [];
        return result.data.map((item: Record<string, unknown>) => ({
            id: String(item.prompt_id || ''),
            title: String(item.title || 'Unknown'),
            primary_category: String(item.primary_category || 'Unknown'),
            category: String(item.primary_category || 'Unknown'),
            path: String(item.directory || ''),
            description: String(item.one_line_description || ''),
            subcategories: []
        }));
    }

    async addToFavorites(promptId: string): Promise<boolean> {
        const result = await this.promptFavoriteRepository.addToFavorites(promptId);
        return result.success;
    }

    async removeFromFavorites(promptId: string): Promise<boolean> {
        const result = await this.promptFavoriteRepository.removeFromFavorites(promptId);
        return result.success;
    }

    async isInFavorites(promptId: string): Promise<boolean> {
        return this.promptFavoriteRepository.isInFavorites(promptId);
    }

    async getPromptDetails(promptId: string): Promise<PromptMetadata | null> {
        const result = await this.getPromptById(promptId);
        return result.success ? (result.data ?? null) : null;
    }

    async getPromptFiles(
        promptIdOrName: string,
        options: { cleanVariables?: boolean } = {}
    ): Promise<{ promptContent: string; metadata: PromptMetadata } | null> {
        const result = await this.promptRepository.getPromptFiles(promptIdOrName, options);
        return result.success && result.data ? result.data : null;
    }

    async getConversationHistory(promptId: string): Promise<any[]> {
        this.loggerService.warn(`getConversationHistory for prompt ${promptId} is not yet implemented.`);
        return [];
    }

    async setVariableValue(promptId: string, variableName: string, value: string): Promise<ApiResult<boolean>> {
        const result = await this.promptService.setVariableValue(promptId, variableName, value);
        return { success: result, data: result };
    }

    async assignFragmentToVariable(
        promptId: string,
        variableName: string,
        fragmentCategory: string,
        fragmentName: string
    ): Promise<string | null> {
        return this.promptService.assignFragmentToVariable(promptId, variableName, fragmentCategory, fragmentName);
    }

    async assignEnvironmentVariable(
        promptId: string,
        variableName: string,
        envVarName: string,
        envVarValue: string
    ): Promise<string | null> {
        return this.promptService.assignEnvironmentVariable(promptId, variableName, envVarName, envVarValue);
    }

    async unsetAllVariables(
        promptId: string,
        variables: PromptVariable[]
    ): Promise<{ success: boolean; errors: { variable: string; error: string }[] }> {
        return this.promptService.unsetAllVariables(promptId, variables);
    }

    formatPromptsTable(prompts: CategoryItem[], options: TableFormatOptions = {}): TableFormatResult<CategoryItem> {
        return this.uiFacade.tableRenderer.formatPromptsTable(prompts, options);
    }

    createTableMenuChoices<T>(
        itemsMap: T[],
        options: {
            headers: string;
            rows: string[];
            separator: string;
            infoText?: string;
            backLabel?: string;
            includeGoBack?: boolean;
            extraActions?: Array<{ name: string; value: string; style?: StyleType }>;
        }
    ): Array<MenuItem<T | string | 'back'>> {
        return this.uiFacade.createTableMenuChoices(
            { headers: options.headers, rows: options.rows, separator: options.separator, itemsMap, maxLengths: {} },
            options
        );
    }

    createPromptActionChoices(options?: {
        isPromptFavorite?: boolean;
        hasConversationHistory?: boolean;
        canEditPrompt?: boolean;
    }): any[] {
        return this.uiFacade.createPromptActionChoices(options);
    }

    formatPromptMetadata(metadata: PromptMetadata, options?: { showVariables?: boolean }): string {
        return this.textFormatter.formatPromptMetadata(metadata, options);
    }

    viewPromptDetails(details: PromptMetadata): void {
        const formattedDetails = this.textFormatter.formatPromptDetailsWithVariables(details);
        this.loggerService.info(formattedDetails);
    }

    allRequiredVariablesSet(details: PromptMetadata): boolean {
        return this.promptService.allRequiredVariablesSet(details);
    }

    async recordExecution(promptId: string): Promise<ApiResult<boolean>> {
        const result = await this.promptExecutionRepository.recordExecution(promptId);
        return { success: result.success, data: result.success };
    }

    async getAllEnvironmentVariables(): Promise<ApiResult<EnvVariable[]>> {
        return this.variableRepository.getAllEnvVars();
    }

    async getAllFragments(): Promise<ApiResult<PromptFragment[]>> {
        return this.fragmentRepository.getAllFragments();
    }

    getCategoryOptions(): { name: string; value: string; description: string }[] {
        return this.categoryService.getAllCategoryOptions();
    }

    async analyzePrompt(
        metadata: SimplePromptMetadata,
        content: string,
        options?: { preserveExisting?: boolean; regenerateHash?: boolean }
    ): Promise<ApiResult<SimplePromptMetadata>> {
        return this.promptAnalysisService.analyzePrompt(metadata, content, options);
    }

    async refreshMetadata(metadata: SimplePromptMetadata, content: string): Promise<ApiResult<SimplePromptMetadata>> {
        return this.promptAnalysisService.refreshMetadata(metadata, content);
    }

    getVariableNameColor(variable: PromptVariable): (text: string) => string {
        return this.promptService.getVariableNameColor(variable);
    }

    getVariableHint(variable: PromptVariable, envVars: EnvVariable[]): string {
        return this.promptService.getVariableHint(variable, envVars);
    }

    formatVariableChoices(
        variables: PromptVariable[],
        envVars: EnvVariable[]
    ): Array<{ name: string; value: PromptVariable }> {
        return this.promptService.formatVariableChoices(variables, envVars);
    }

    getMatchingEnvironmentVariables(variable: PromptVariable, envVars: EnvVariable[]): EnvVariable[] {
        return this.promptService.getMatchingEnvironmentVariables(variable, envVars);
    }
}
