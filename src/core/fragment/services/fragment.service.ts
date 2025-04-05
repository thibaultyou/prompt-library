import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { ErrorService, AppError } from '../../../infrastructure/error/services/error.service';
import { isDirectory, readDirectory } from '../../../infrastructure/file-system/utils/file-system.utils';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { appConfig } from '../../../shared/config';
import { ApiResult, PromptFragment, Result } from '../../../shared/types';
import { IFragmentRepository } from '../repositories/fragment.repository.interface';

@Injectable({ scope: Scope.DEFAULT })
export class FragmentService {
    constructor(
        @Inject(IFragmentRepository) private readonly repository: IFragmentRepository,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService))
        private readonly errorService: ErrorService
    ) {}

    async getAllFragments(): Promise<ApiResult<PromptFragment[]>> {
        this.loggerService.debug('FragmentService: Getting all fragments.');
        return this.repository.getAllFragments();
    }

    async getFragmentContent(category: string, name: string): Promise<ApiResult<string>> {
        this.loggerService.debug(`FragmentService: Getting content for ${category}/${name}.`);
        return this.repository.getFragmentContent(category, name);
    }

    async createFragment(category: string, name: string, content: string): Promise<ApiResult<boolean>> {
        this.loggerService.debug(`FragmentService: Creating fragment ${category}/${name}.`);
        const result = await this.repository.addFragment(category, name, content);
        return { success: result.success, data: result.success, error: result.error };
    }

    async updateFragment(category: string, name: string, content: string): Promise<ApiResult<boolean>> {
        this.loggerService.debug(`FragmentService: Updating fragment ${category}/${name}.`);
        const result = await this.repository.updateFragment(category, name, content);
        return { success: result.success, data: result.success, error: result.error };
    }

    async deleteFragment(category: string, name: string): Promise<ApiResult<boolean>> {
        this.loggerService.debug(`FragmentService: Deleting fragment ${category}/${name}.`);
        const result = await this.repository.deleteFragment(category, name);
        return { success: result.success, data: result.success, error: result.error };
    }

    async getCategories(): Promise<ApiResult<string[]>> {
        this.loggerService.debug('FragmentService: Getting all categories.');
        return this.repository.getFragmentCategories();
    }

    async getFragmentsByCategory(category: string): Promise<ApiResult<PromptFragment[]>> {
        this.loggerService.debug(`FragmentService: Getting fragments for category ${category}.`);
        return this.repository.getFragmentsByCategory(category);
    }

    async searchFragments(keyword: string): Promise<ApiResult<PromptFragment[]>> {
        this.loggerService.debug(`FragmentService: Searching fragments with keyword "${keyword}".`);

        try {
            const result = await this.getAllFragments();

            if (!result.success || !result.data) {
                return Result.failure(result.error || 'Failed to retrieve fragments.');
            }

            const fragments = result.data;
            const searchTerm = keyword.toLowerCase();
            const filteredFragments = fragments.filter(
                (fragment) =>
                    fragment.name.toLowerCase().includes(searchTerm) ||
                    fragment.category.toLowerCase().includes(searchTerm)
            );
            this.loggerService.debug(`Found ${filteredFragments.length} fragments matching "${keyword}".`);
            return Result.success(filteredFragments);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`FragmentService: Error searching fragments: ${message}`);
            return Result.failure(`Failed to search fragments: ${message}`);
        }
    }

    formatFragmentPath(fragment: PromptFragment): string {
        return `fragments/${fragment.category}/${fragment.name}`;
    }

    formatFragmentDisplay(fragment: PromptFragment): string {
        return `${this.stringFormatterService.formatTitleCase(fragment.category)} > ${this.stringFormatterService.formatTitleCase(fragment.name)}`;
    }

    async listAvailableFragments(): Promise<ApiResult<string>> {
        try {
            this.loggerService.info('Listing available fragments');
            const fragmentsDir = path.join(appConfig.FRAGMENTS_DIR);
            const categories = await readDirectory(fragmentsDir);
            const fragments: Record<string, string[]> = {};
            await Promise.all(
                categories.map(async (category) => {
                    const categoryPath = path.join(fragmentsDir, category);

                    if (await isDirectory(categoryPath)) {
                        const categoryFragments = await readDirectory(categoryPath);
                        fragments[category] = categoryFragments
                            .filter((f) => f.endsWith('.md'))
                            .map((f) => path.parse(f).name);
                        this.loggerService.debug(
                            `Found ${fragments[category].length} fragments in category ${category}`
                        );
                    }
                })
            );
            this.loggerService.info(`Listed fragments from ${Object.keys(fragments).length} categories`);
            return Result.success(JSON.stringify(fragments, null, 2));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FRAGMENT_ERROR', `Failed list fragments: ${message}`),
                'FragmentService.listAvailableFragments'
            );
            return Result.failure(`Failed to list available fragments: ${message}`);
        }
    }
}
