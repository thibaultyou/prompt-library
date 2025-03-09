import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import fs from 'fs-extra';

import { IFragmentRepository } from '../../../core/fragment/repositories/fragment.repository.interface';
import { FRAGMENTS_DIR } from '../../../shared/constants';
import { ApiResult, PromptFragment, Result } from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqliteFragmentRepository implements IFragmentRepository {
    constructor(
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService))
        private readonly errorService: ErrorService
    ) {}

    private getFragmentPath(category: string, name: string): string {
        const safeCategory = category.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        return path.join(FRAGMENTS_DIR, safeCategory, `${safeName}.md`);
    }

    private sanitizeName(name: string): string {
        return this.stringFormatterService.normalizeVariableName(name, false);
    }

    private async cleanupEmptyCategoryDir(category: string): Promise<void> {
        const categoryDir = path.join(FRAGMENTS_DIR, category);

        try {
            if (!(await fs.pathExists(categoryDir))) return;

            const files = await fs.readdir(categoryDir);

            if (files.length === 0) {
                this.loggerService.debug(`Removing empty category directory: ${categoryDir}`);
                await fs.remove(categoryDir);
                this.loggerService.info(`Removed empty category directory: ${category}`);
            }
        } catch (error) {
            this.loggerService.warn(`Failed to cleanup empty category directory ${category}: ${error}`);
        }
    }

    async getAllFragments(): Promise<ApiResult<PromptFragment[]>> {
        try {
            const fragments: PromptFragment[] = [];

            if (!(await fs.pathExists(FRAGMENTS_DIR))) {
                this.loggerService.debug(`Fragments directory does not exist: ${FRAGMENTS_DIR}`);
                return Result.success([]);
            }

            const categories = await fs.readdir(FRAGMENTS_DIR);
            this.loggerService.debug(
                `Scanning ${categories.length} potential category directories in ${FRAGMENTS_DIR}`
            );

            for (const category of categories) {
                const categoryPath = path.join(FRAGMENTS_DIR, category);

                try {
                    const stat = await fs.stat(categoryPath);

                    if (!stat.isDirectory()) continue;

                    const files = await fs.readdir(categoryPath);

                    for (const file of files) {
                        if (file.endsWith('.md')) {
                            const name = file.replace('.md', '');
                            fragments.push({ category, name });
                        }
                    }
                } catch (dirError) {
                    this.loggerService.warn(`Error reading category directory ${categoryPath}: ${dirError}`);
                }
            }
            this.loggerService.debug(`Retrieved ${fragments.length} fragments total.`);
            return Result.success(fragments);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to list fragments: ${message}`),
                'SqliteFragmentRepository.getAllFragments'
            );
            return Result.failure(`Failed to list fragments: ${message}`);
        }
    }

    async getFragmentContent(category: string, name: string): Promise<ApiResult<string>> {
        const fragmentPath = this.getFragmentPath(category, name);
        this.loggerService.debug(`Attempting to read fragment content from: ${fragmentPath}`);

        try {
            if (!(await fs.pathExists(fragmentPath))) {
                this.loggerService.warn(`Fragment file not found: ${fragmentPath}`);
                return Result.failure(`Fragment ${category}/${name} not found.`);
            }

            const content = await fs.readFile(fragmentPath, 'utf-8');
            this.loggerService.debug(`Successfully read content for fragment: ${category}/${name}`);
            return Result.success(content);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to read fragment ${fragmentPath}: ${message}`),
                'SqliteFragmentRepository.getFragmentContent'
            );
            return Result.failure(`Failed to read fragment content: ${message}`);
        }
    }

    async addFragment(category: string, name: string, content: string): Promise<ApiResult<void>> {
        if (!category || !name) return Result.failure('Category and name are required.');

        const cleanCategory = this.sanitizeName(category);
        const cleanName = this.sanitizeName(name);
        const fragmentPath = this.getFragmentPath(cleanCategory, cleanName);
        this.loggerService.debug(`Attempting to add fragment at: ${fragmentPath}`);

        try {
            const categoryDir = path.dirname(fragmentPath);
            await fs.ensureDir(categoryDir);
            this.loggerService.debug(`Ensured category directory exists: ${categoryDir}`);

            if (await fs.pathExists(fragmentPath)) {
                this.loggerService.warn(`Fragment already exists at ${fragmentPath}. Cannot add.`);
                return Result.failure(`Fragment ${cleanCategory}/${cleanName} already exists.`);
            }

            await fs.writeFile(fragmentPath, content, 'utf8');
            this.loggerService.info(`Successfully added fragment: ${cleanCategory}/${cleanName}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to add fragment ${fragmentPath}: ${message}`),
                'SqliteFragmentRepository.addFragment'
            );
            return Result.failure(`Failed to add fragment: ${message}`);
        }
    }

    async updateFragment(category: string, name: string, content: string): Promise<ApiResult<void>> {
        const fragmentPath = this.getFragmentPath(category, name);
        this.loggerService.debug(`Attempting to update fragment at: ${fragmentPath}`);

        try {
            if (!(await fs.pathExists(fragmentPath))) {
                this.loggerService.warn(`Fragment file not found for update: ${fragmentPath}`);
                return Result.failure(`Fragment ${category}/${name} does not exist.`);
            }

            await fs.writeFile(fragmentPath, content, 'utf8');
            this.loggerService.info(`Successfully updated fragment: ${category}/${name}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to update fragment ${fragmentPath}: ${message}`),
                'SqliteFragmentRepository.updateFragment'
            );
            return Result.failure(`Failed to update fragment: ${message}`);
        }
    }

    async deleteFragment(category: string, name: string): Promise<ApiResult<void>> {
        const fragmentPath = this.getFragmentPath(category, name);
        this.loggerService.debug(`Attempting to delete fragment at: ${fragmentPath}`);

        try {
            if (!(await fs.pathExists(fragmentPath))) {
                this.loggerService.warn(`Fragment file not found for deletion: ${fragmentPath}`);
                return Result.failure(`Fragment ${category}/${name} does not exist.`);
            }

            await fs.remove(fragmentPath);
            this.loggerService.info(`Successfully deleted fragment file: ${fragmentPath}`);
            await this.cleanupEmptyCategoryDir(category);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to delete fragment ${fragmentPath}: ${message}`),
                'SqliteFragmentRepository.deleteFragment'
            );
            return Result.failure(`Failed to delete fragment: ${message}`);
        }
    }

    async getFragmentCategories(): Promise<ApiResult<string[]>> {
        try {
            const fragmentsResult = await this.getAllFragments();

            if (!fragmentsResult.success || !fragmentsResult.data) {
                return Result.failure(fragmentsResult.error || 'Failed to retrieve fragments.');
            }

            const categories = new Set(fragmentsResult.data.map((f) => f.category));
            const sortedCategories = Array.from(categories).sort();
            this.loggerService.debug(`Found ${sortedCategories.length} unique fragment categories.`);
            return Result.success(sortedCategories);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to get fragment categories: ${message}`),
                'SqliteFragmentRepository.getFragmentCategories'
            );
            return Result.failure(`Failed to get fragment categories: ${message}`);
        }
    }

    async getFragmentsByCategory(category: string): Promise<ApiResult<PromptFragment[]>> {
        try {
            const fragmentsResult = await this.getAllFragments();

            if (!fragmentsResult.success || !fragmentsResult.data) {
                return Result.failure(fragmentsResult.error || 'Failed to retrieve fragments.');
            }

            const filtered = fragmentsResult.data.filter((f) => f.category === category);
            this.loggerService.debug(`Found ${filtered.length} fragments in category: ${category}`);
            return Result.success(filtered);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to get fragments for category ${category}: ${message}`),
                'SqliteFragmentRepository.getFragmentsByCategory'
            );
            return Result.failure(`Failed to get fragments for category ${category}: ${message}`);
        }
    }

    async getFragmentByPath(fragmentPath: string): Promise<ApiResult<PromptFragment>> {
        const parts = fragmentPath.split('/');

        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            const errorMsg = `Invalid fragment path format: "${fragmentPath}". Expected "category/name".`;
            this.loggerService.warn(errorMsg);
            return Result.failure(errorMsg);
        }

        const [category, name] = parts;
        const fragmentFilePath = this.getFragmentPath(category, name);
        this.loggerService.debug(`Looking up fragment by path: ${fragmentFilePath}`);

        try {
            if (!(await fs.pathExists(fragmentFilePath))) {
                this.loggerService.warn(`Fragment not found at path: ${fragmentFilePath}`);
                return Result.failure(`Fragment not found: ${fragmentPath}`);
            }
            return Result.success({ category, name });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Error checking fragment path ${fragmentFilePath}: ${message}`),
                'SqliteFragmentRepository.getFragmentByPath'
            );
            return Result.failure(`Failed to get fragment by path: ${message}`);
        }
    }

    async fragmentExists(category: string, name: string): Promise<boolean> {
        const fragmentPath = this.getFragmentPath(category, name);

        try {
            return await fs.pathExists(fragmentPath);
        } catch (error) {
            this.loggerService.warn(`Error checking existence of fragment ${fragmentPath}: ${error}`);
            return false;
        }
    }

    async renameFragment(
        category: string,
        name: string,
        newCategory: string,
        newName: string
    ): Promise<ApiResult<void>> {
        const oldPath = this.getFragmentPath(category, name);
        const newPath = this.getFragmentPath(newCategory, newName);
        this.loggerService.debug(`Attempting to rename fragment from ${oldPath} to ${newPath}`);

        try {
            if (!(await fs.pathExists(oldPath)))
                return Result.failure(`Source fragment ${category}/${name} does not exist.`);

            if (await fs.pathExists(newPath))
                return Result.failure(`Target fragment ${newCategory}/${newName} already exists.`);

            const newCategoryDir = path.dirname(newPath);
            await fs.ensureDir(newCategoryDir);
            await fs.move(oldPath, newPath);
            this.loggerService.info(`Renamed fragment: ${category}/${name} -> ${newCategory}/${newName}`);

            if (category !== newCategory) await this.cleanupEmptyCategoryDir(category);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to rename fragment: ${message}`),
                'SqliteFragmentRepository.renameFragment'
            );
            return Result.failure(`Failed to rename fragment: ${message}`);
        }
    }

    async copyFragment(
        category: string,
        name: string,
        targetCategory: string,
        targetName: string
    ): Promise<ApiResult<void>> {
        const sourcePath = this.getFragmentPath(category, name);
        const targetPath = this.getFragmentPath(targetCategory, targetName);
        this.loggerService.debug(`Attempting to copy fragment from ${sourcePath} to ${targetPath}`);

        try {
            if (!(await fs.pathExists(sourcePath)))
                return Result.failure(`Source fragment ${category}/${name} does not exist.`);

            if (await fs.pathExists(targetPath))
                return Result.failure(`Target fragment ${targetCategory}/${targetName} already exists.`);

            const targetCategoryDir = path.dirname(targetPath);
            await fs.ensureDir(targetCategoryDir);
            await fs.copy(sourcePath, targetPath);
            this.loggerService.info(`Copied fragment: ${category}/${name} -> ${targetCategory}/${targetName}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('FS_ERROR', `Failed to copy fragment: ${message}`),
                'SqliteFragmentRepository.copyFragment'
            );
            return Result.failure(`Failed to copy fragment: ${message}`);
        }
    }
}
