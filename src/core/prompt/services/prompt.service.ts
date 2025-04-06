import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { ENV_PREFIX, FRAGMENT_PREFIX, CATEGORY_DESCRIPTIONS } from '../../../shared/constants';
import { ApiResult, CategoryItem, EnvVariable, PromptMetadata, PromptVariable, Result } from '../../../shared/types';
import { IFragmentRepository } from '../../fragment/repositories/fragment.repository.interface';
import { IPromptMetadataRepository } from '../repositories/prompt-metadata.repository.interface';
import { IPromptRepository } from '../repositories/prompt.repository.interface';

@Injectable({ scope: Scope.DEFAULT })
export class PromptService {
    constructor(
        @Inject(IPromptRepository) private readonly promptRepo: IPromptRepository,
        @Inject(IPromptMetadataRepository) private readonly metadataRepo: IPromptMetadataRepository,
        @Inject(IFragmentRepository) private readonly fragmentRepo: IFragmentRepository,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    async getCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
        this.loggerService.debug('PromptService: Getting categories.');
        return this.metadataRepo.getCategories();
    }

    async getAllPrompts(): Promise<ApiResult<CategoryItem[]>> {
        this.loggerService.debug('PromptService: Getting all prompts list.');
        return this.metadataRepo.getAllPromptsList();
    }

    async getPromptsSortedById(): Promise<ApiResult<CategoryItem[]>> {
        this.loggerService.debug('PromptService: Getting prompts sorted by ID.');

        try {
            const allPromptsResult = await this.getAllPrompts();

            if (!allPromptsResult.success || !allPromptsResult.data) {
                return Result.failure(allPromptsResult.error || 'Failed to retrieve prompts.');
            }

            const sorted = [...allPromptsResult.data].sort((a, b) => Number(a.id) - Number(b.id));
            return Result.success(sorted);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`PromptService: Error sorting prompts by ID: ${message}`);
            return Result.failure(`Failed to get prompts sorted by ID: ${message}`);
        }
    }

    async searchPrompts(searchTerm: string): Promise<ApiResult<Array<CategoryItem & { matchScore: number }>>> {
        this.loggerService.debug(`PromptService: Searching prompts with term "${searchTerm}".`);

        try {
            const allPromptsResult = await this.getAllPrompts();

            if (!allPromptsResult.success || !allPromptsResult.data) {
                return Result.failure(allPromptsResult.error || 'Failed to retrieve prompts.');
            }

            const allPrompts = allPromptsResult.data;
            const term = searchTerm.toLowerCase();
            const SCORE = {
                TITLE_EXACT_WORD: 1000,
                TITLE_START: 500,
                TITLE_CONTAINS: 200,
                DESCRIPTION: 100,
                CATEGORY: 50,
                PATH: 25
            };
            const matchedPrompts: Array<CategoryItem & { matchScore: number }> = [];

            function hasExactWordMatch(text: string, term: string): boolean {
                if (!text) return false;

                const regex = new RegExp(`\\b${term}\\b`, 'i');
                return regex.test(text);
            }

            for (const prompt of allPrompts) {
                let matchScore = 0;
                const titleLower = prompt.title.toLowerCase();
                const descriptionLower = prompt.description?.toLowerCase() ?? '';
                const categoryLower = prompt.primary_category?.toLowerCase() ?? '';
                const pathLower = prompt.path?.toLowerCase() ?? '';

                if (hasExactWordMatch(titleLower, term)) matchScore += SCORE.TITLE_EXACT_WORD;
                else if (titleLower.startsWith(term)) matchScore += SCORE.TITLE_START;
                else if (titleLower.includes(term)) matchScore += SCORE.TITLE_CONTAINS;

                if (descriptionLower.includes(term)) matchScore += SCORE.DESCRIPTION;

                if (categoryLower.includes(term)) matchScore += SCORE.CATEGORY;

                if (pathLower.includes(term)) matchScore += SCORE.PATH;

                if (matchScore > 0) matchedPrompts.push({ ...prompt, matchScore });
            }
            const sortedResults = matchedPrompts.sort(
                (a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title)
            );
            this.loggerService.debug(`Found ${sortedResults.length} prompts matching "${searchTerm}".`);
            return Result.success(sortedResults);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`PromptService: Error searching prompts: ${message}`);
            return Result.failure(`Failed to search prompts: ${message}`);
        }
    }

    getCategoryDescription(categorySlug: string): string {
        return (
            CATEGORY_DESCRIPTIONS[categorySlug] ||
            `${this.stringFormatterService.formatTitleCase(categorySlug)} prompts`
        );
    }

    allRequiredVariablesSet(details: PromptMetadata): boolean {
        if (!details.variables || details.variables.length === 0) return true;
        return details.variables.every((v) => v.optional_for_user || (v.value && v.value.trim() !== ''));
    }

    async getPromptById(promptId: string): Promise<ApiResult<PromptMetadata | null>> {
        this.loggerService.debug(`PromptService: Getting prompt by ID: ${promptId}`);
        const result = await this.promptRepo.getPromptById(promptId);

        if (!result.success)
            this.loggerService.error(`PromptService: Failed get prompt ID ${promptId}: ${result.error}`);
        return result;
    }

    async getPromptFiles(
        promptIdOrDir: string,
        options: { cleanVariables?: boolean } = {}
    ): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>> {
        this.loggerService.debug(`PromptService: Getting prompt files for identifier: ${promptIdOrDir}`);
        const result = await this.promptRepo.getPromptFiles(promptIdOrDir, options);

        if (!result.success)
            this.loggerService.error(`PromptService: Failed get files for ${promptIdOrDir}: ${result.error}`);
        return result as ApiResult<{ promptContent: string; metadata: PromptMetadata }>;
    }

    async setVariableValue(promptId: string, variableName: string, value: string): Promise<boolean> {
        this.loggerService.debug(`PromptService: Setting variable "${variableName}" for prompt ID ${promptId}.`);
        const updateResult = await this.promptRepo.updateVariable(promptId, variableName, value);

        if (!updateResult.success)
            this.loggerService.error(`PromptService: Failed set variable: ${updateResult.error}`);
        return updateResult.success;
    }

    async assignFragmentToVariable(
        promptId: string,
        variableName: string,
        fragmentCategory: string,
        fragmentName: string
    ): Promise<string | null> {
        this.loggerService.debug(
            `PromptService: Assigning fragment ${fragmentCategory}/${fragmentName} to var "${variableName}" for prompt ID ${promptId}.`
        );
        const fragmentRef = `${FRAGMENT_PREFIX}${fragmentCategory}/${fragmentName}`;
        const success = await this.setVariableValue(promptId, variableName, fragmentRef);

        if (!success) {
            this.loggerService.error(`PromptService: Failed assign fragment ref.`);
            return null;
        }

        const contentResult = await this.fragmentRepo.getFragmentContent(fragmentCategory, fragmentName);

        if (!contentResult.success || contentResult.data === undefined) {
            this.loggerService.warn(
                `PromptService: Assigned fragment ref, but failed get content: ${contentResult.error}`
            );
            return null;
        }
        return contentResult.data;
    }

    async assignEnvironmentVariable(
        promptId: string,
        variableName: string,
        envVarName: string,
        envVarValue: string
    ): Promise<string | null> {
        this.loggerService.debug(
            `PromptService: Assigning env var "${envVarName}" to var "${variableName}" for prompt ID ${promptId}.`
        );
        const envVarRef = `${ENV_PREFIX}${envVarName}`;
        const success = await this.setVariableValue(promptId, variableName, envVarRef);

        if (!success) {
            this.loggerService.error(`PromptService: Failed assign env var ref.`);
            return null;
        }
        return envVarValue;
    }

    getMatchingEnvironmentVariables(variable: PromptVariable, envVars: EnvVariable[]): EnvVariable[] {
        const promptVarNameLower = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));

        if (!promptVarNameLower) return [];
        return envVars.filter((ev) => {
            const envVarNameLower = this.stringFormatterService.formatSnakeCase(ev.name);

            if (!envVarNameLower) return false;
            return envVarNameLower.includes(promptVarNameLower) || promptVarNameLower.includes(envVarNameLower);
        });
    }

    async unsetAllVariables(
        promptId: string,
        variables: PromptVariable[]
    ): Promise<{ success: boolean; errors: { variable: string; error: string }[] }> {
        this.loggerService.debug(`PromptService: Unsetting all variables for prompt ID ${promptId}.`);
        const errors: { variable: string; error: string }[] = [];

        for (const variable of variables) {
            if (variable.value && variable.value.trim() !== '') {
                const success = await this.setVariableValue(promptId, variable.name, '');

                if (!success) errors.push({ variable: variable.name, error: 'Failed to unset value.' });
            }
        }

        if (errors.length > 0)
            this.loggerService.warn(
                `PromptService: Encountered ${errors.length} errors unsetting variables for prompt ID ${promptId}.`
            );
        else
            this.loggerService.debug(
                `PromptService: Successfully unset values for variables of prompt ID ${promptId}.`
            );
        return { success: errors.length === 0, errors };
    }

    getVariableNameColor(variable: PromptVariable): (text: string) => string {
        if (variable.value && variable.value.trim() !== '') {
            if (variable.value.startsWith(FRAGMENT_PREFIX)) return chalk.blue;

            if (variable.value.startsWith(ENV_PREFIX)) return chalk.magenta;
            return chalk.green;
        }
        return variable.optional_for_user ? chalk.yellow : chalk.red;
    }

    getVariableHint(variable: PromptVariable, envVars: EnvVariable[]): string {
        if (!variable.value || variable.value.trim() === '') {
            const promptVarNameLower = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
            const matchingEnvVar = envVars.find(
                (env) => this.stringFormatterService.formatSnakeCase(env.name) === promptVarNameLower
            );

            if (matchingEnvVar) return chalk.magenta(' (env available)');
        }
        return '';
    }

    formatVariableChoices(
        variables: PromptVariable[],
        envVars: EnvVariable[]
    ): Array<{ name: string; value: PromptVariable }> {
        return variables.map((v) => {
            const nameColor = this.getVariableNameColor(v);
            const hint = this.getVariableHint(v, envVars);
            const requiredMark = v.optional_for_user ? '' : '*';
            const displayName = this.stringFormatterService.formatSnakeCase(v.name.replace(/[{}]/g, ''));
            const nameString = `${nameColor(displayName)}${chalk.reset(requiredMark)}${hint}`;
            return { name: nameString, value: v };
        });
    }
}
