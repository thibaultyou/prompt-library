import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { CATEGORY_DESCRIPTIONS } from '../../../shared/constants';
import { ApiResult, CategoryItem, Result } from '../../../shared/types';
import { IPromptMetadataRepository } from '../repositories/prompt-metadata.repository.interface';

@Injectable({ scope: Scope.DEFAULT })
export class CategoryService {
    constructor(
        @Inject(IPromptMetadataRepository) private readonly metadataRepo: IPromptMetadataRepository,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService
    ) {}

    getAllCategoryOptions(): Array<{ name: string; value: string; description: string }> {
        try {
            return Object.entries(CATEGORY_DESCRIPTIONS)
                .map(([value, description]) => ({
                    name: this.stringFormatterService.formatTitleCase(value),
                    value,
                    description
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to get category options: ${message}`);
            return [];
        }
    }

    getCategoryDescription(categorySlug: string): string {
        try {
            return (
                CATEGORY_DESCRIPTIONS[categorySlug] ||
                `${this.stringFormatterService.formatTitleCase(categorySlug)} prompts`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to get description for category "${categorySlug}": ${message}`);
            return `${this.stringFormatterService.formatTitleCase(categorySlug)} prompts`;
        }
    }

    categoryExists(categorySlug: string): boolean {
        try {
            return categorySlug in CATEGORY_DESCRIPTIONS;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to check existence of category "${categorySlug}": ${message}`);
            return false;
        }
    }

    getCategoryName(categorySlug: string): string {
        try {
            return this.stringFormatterService.formatTitleCase(categorySlug);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to format category name "${categorySlug}": ${message}`);
            return categorySlug;
        }
    }

    async getAllCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
        this.loggerService.debug('CategoryService: Getting all categories with prompts.');

        try {
            return await this.metadataRepo.getCategories();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`CategoryService: Failed to get all categories: ${message}`);
            return Result.failure(`Failed to get categories: ${message}`);
        }
    }

    async getCategoryNames(): Promise<ApiResult<string[]>> {
        this.loggerService.debug('CategoryService: Getting category names.');

        try {
            const result = await this.getAllCategories();

            if (!result.success || !result.data) {
                return Result.failure(result.error || 'Failed to retrieve categories.');
            }

            const names = Object.keys(result.data).sort();
            return Result.success(names);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`CategoryService: Failed to get category names: ${message}`);
            return Result.failure(`Failed to get category names: ${message}`);
        }
    }

    async getCategoryByName(categoryName: string): Promise<ApiResult<CategoryItem[]>> {
        this.loggerService.debug(`CategoryService: Getting prompts for category "${categoryName}".`);

        try {
            const result = await this.getAllCategories();

            if (!result.success || !result.data) {
                return Result.failure(result.error || `Failed to retrieve categories.`);
            }

            const categories = result.data;

            if (!categories[categoryName]) {
                this.loggerService.warn(`Category "${categoryName}" not found.`);
                return Result.failure(`Category not found: ${categoryName}`);
            }
            return Result.success(categories[categoryName]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`CategoryService: Failed get category by name "${categoryName}": ${message}`);
            return Result.failure(`Failed to get category by name: ${message}`);
        }
    }
}
