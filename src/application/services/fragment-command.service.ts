import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';
import fs from 'fs-extra';

import { SyncCommandService } from './sync-command.service';
import { FragmentService } from '../../core/fragment/services/fragment.service';
import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../infrastructure/repository/services/repository.service';
import { TableRenderer } from '../../infrastructure/ui/components/table.renderer';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { EditorService } from '../../infrastructure/ui/services/editor.service';
import { cliConfig } from '../../shared/config/cli-config';
import { WARNING_MESSAGES } from '../../shared/constants';
import { ExtendedApiResult, PromptFragment, ApiResult, Result, MenuItem } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class FragmentCommandService {
    constructor(
        private readonly fragmentService: FragmentService,
        private readonly uiFacade: UiFacade,
        private readonly loggerService: LoggerService,
        private readonly editorService: EditorService,
        private readonly errorService: ErrorService,
        private readonly tableRenderer: TableRenderer,
        private readonly repositoryService: RepositoryService,
        @Inject(forwardRef(() => SyncCommandService)) private readonly syncCommandService: SyncCommandService
    ) {}

    public async collectFragmentData(options: Record<string, unknown>): Promise<ExtendedApiResult<PromptFragment>> {
        try {
            let category = options.category as string | undefined;
            let createdNewCategory = false;
            let categoryName = '';

            if (!category) {
                const categoryResult = await this.selectFragmentCategory();

                if (!categoryResult.success || !categoryResult.data) {
                    return Result.failure(categoryResult.error || 'No category selected');
                }

                category = categoryResult.data;

                if (categoryResult._createdNewCategory === true) {
                    createdNewCategory = true;
                    categoryName = categoryResult._categoryName || category;
                }
            }

            let name = options.name as string | undefined;

            if (!name && options.isInteractive !== false) {
                try {
                    const result = await this.uiFacade.getInput('Enter fragment name:', undefined, true);

                    if (!result || result.trim() === '') {
                        return Result.failure('Fragment creation cancelled - name required');
                    }

                    name = result.trim();
                    // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_error) {
                    return Result.failure('Fragment creation cancelled');
                }
            } else if (!name) {
                return Result.failure('Fragment name is required');
            }

            name = this.uiFacade.formatMessage(
                name
                    .toLowerCase()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '')
            );
            return {
                success: true,
                data: { category, name },
                _createdNewCategory: createdNewCategory,
                _categoryName: categoryName
            };
        } catch (error) {
            return Result.failure(
                `Error collecting fragment data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async selectFragmentCategory(): Promise<ExtendedApiResult<string>> {
        try {
            const dirExists = await fs.pathExists(cliConfig.FRAGMENTS_DIR);

            if (!dirExists) {
                await fs.ensureDir(cliConfig.FRAGMENTS_DIR);
                this.loggerService.info('Created fragments directory');
            }

            const categories = await fs.readdir(cliConfig.FRAGMENTS_DIR);
            const choices: MenuItem<'header' | 'separator' | 'new' | 'back' | string>[] = [
                {
                    name: chalk.bold(chalk.cyan('📁 EXISTING CATEGORIES')),
                    value: 'header' as const,
                    disabled: true,
                    type: 'header'
                },
                ...categories.sort().map((cat) => ({ name: cat, value: cat, type: 'item' as const })),
                { name: '─'.repeat(50), value: 'separator' as const, disabled: true, type: 'separator' },
                { name: chalk.green('Create new category'), value: 'new' as const, type: 'item' as const }
            ];
            const selectedCategory = await this.uiFacade.selectMenu<'header' | 'separator' | 'new' | 'back' | string>(
                'Select or create category:',
                choices,
                { includeGoBack: true }
            );

            if (selectedCategory === 'back') return Result.failure('Category selection cancelled');

            if (selectedCategory === 'new') {
                const newCategory = await this.uiFacade.getInput('Enter new category name:', undefined, true);

                if (!newCategory || newCategory.trim() === '') {
                    return Result.failure('Category creation cancelled - name required');
                }

                const formattedCategory = this.uiFacade.formatMessage(
                    newCategory
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '')
                );
                const createResult = await this.createCategory(formattedCategory);

                if (!createResult.success) return createResult;
                return {
                    success: true,
                    data: formattedCategory,
                    _createdNewCategory: true,
                    _categoryName: formattedCategory
                };
            }
            return { success: true, data: selectedCategory };
        } catch (error) {
            if (error instanceof Error && error.message.includes('User cancelled')) {
                this.loggerService.warn('Category selection cancelled by user.');
                return Result.failure('Category selection cancelled');
            }

            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error selecting category: ${message}`);
            return Result.failure(`Error selecting category: ${message}`);
        }
    }

    public async createCategory(categoryName: string): Promise<ApiResult<string>> {
        try {
            const formattedCategory = this.uiFacade.formatMessage(
                categoryName
                    .toLowerCase()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '')
            );
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, formattedCategory);
            await fs.ensureDir(categoryPath);
            this.loggerService.info(`Created new category: ${formattedCategory}`);
            return Result.success(formattedCategory);
        } catch (error) {
            return Result.failure(`Error creating category: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async cleanupEmptyCategory(category: string): Promise<ApiResult<boolean>> {
        try {
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, category);

            if (!(await fs.pathExists(categoryPath)))
                return Result.failure(`Category directory not found: ${category}`);

            const files = await fs.readdir(categoryPath);

            if (files.length > 0) return Result.success(false, { error: 'Category is not empty' });

            await fs.remove(categoryPath);
            this.loggerService.info(`Removed empty category directory: ${category}`);
            return Result.success(true);
        } catch (error) {
            return Result.failure(
                `Error cleaning up category: ${error instanceof Error ? error.message : String(error)}`,
                { data: false }
            );
        }
    }

    public async collectFragmentContent(fragment: PromptFragment): Promise<ApiResult<string>> {
        try {
            let content = '';
            const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, fragment.category, `${fragment.name}.md`);
            const editorOptions = { message: '', postfix: '.md' };

            if (await fs.pathExists(fragmentPath)) {
                content = await fs.readFile(fragmentPath, 'utf8');
                this.loggerService.info('Current content loaded. Opening editor...');
                editorOptions.message = 'Edit fragment content (opens editor):';
            } else {
                this.loggerService.info('Opening editor for new fragment content...');
                content = `# ${fragment.name}\n\nEnter fragment content.`;
                editorOptions.message = 'Create fragment content (opens editor):';
            }

            const editorResult = await this.editorService.editInEditor(content, editorOptions);

            if (!editorResult.success) return editorResult;
            return Result.success(editorResult.data ?? content);
        } catch (error) {
            return Result.failure(
                `Error collecting fragment content: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getFragmentContent(fragment: PromptFragment): Promise<ApiResult<string>> {
        return this.fragmentService.getFragmentContent(fragment.category, fragment.name);
    }

    public async saveFragmentContent(fragment: PromptFragment, content: string): Promise<ApiResult<void>> {
        try {
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, fragment.category);
            await fs.ensureDir(categoryPath);
            const fragmentPath = path.join(categoryPath, `${fragment.name}.md`);
            await fs.writeFile(fragmentPath, content);
            this.loggerService.info(`Fragment ${fragment.category}/${fragment.name} saved.`);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to save fragment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async trackFragmentChange(
        fragment: PromptFragment,
        _changeType: 'add' | 'modify' | 'delete'
    ): Promise<ApiResult<void>> {
        try {
            await this.repositoryService.stageFragmentChanges(fragment.category, fragment.name);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(
                `Error tracking fragment change: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async offerRemoteSync(): Promise<ApiResult<boolean>> {
        return this.syncCommandService.offerRemoteSync();
    }

    public async loadFragmentForEditing(category: string, name: string): Promise<ApiResult<PromptFragment>> {
        try {
            const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, category, `${name}.md`);

            if (!(await fs.pathExists(fragmentPath))) {
                return Result.failure(`Fragment ${category}/${name} not found`);
            }
            return Result.success({ category, name });
        } catch (error) {
            return Result.failure(
                `Failed load fragment for editing: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async deleteFragment(category: string, name: string): Promise<ApiResult<void>> {
        try {
            const fragmentResult = await this.loadFragmentForEditing(category, name);

            if (!fragmentResult.success || !fragmentResult.data) {
                return Result.failure(fragmentResult.error || `Cannot find fragment ${category}/${name}`);
            }

            const fragment = fragmentResult.data;
            const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, fragment.category, `${fragment.name}.md`);
            await fs.remove(fragmentPath);
            await this.cleanupEmptyCategory(fragment.category);
            await this.repositoryService.stageFragmentChanges(fragment.category, fragment.name);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(
                `Failed to delete fragment: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async deleteCategory(category: string): Promise<ApiResult<void>> {
        try {
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, category);

            if (!(await fs.pathExists(categoryPath))) {
                return Result.failure(`Category directory not found: ${category}`);
            }

            await fs.remove(categoryPath);
            await this.repositoryService.stageFragmentChanges(category);
            this.loggerService.success(`Deleted category: ${category} and all fragments.`);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(
                `Failed to delete category: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async updateFragment(category: string, name: string, content: string): Promise<ApiResult<void>> {
        try {
            const fragmentResult = await this.loadFragmentForEditing(category, name);

            if (!fragmentResult.success || !fragmentResult.data) {
                return Result.failure(fragmentResult.error || `Cannot find fragment ${category}/${name}`);
            }

            if (!content || content.trim() === '') return Result.failure('Fragment content cannot be empty');

            const fragment = fragmentResult.data;
            const saveResult = await this.saveFragmentContent(fragment, content);

            if (!saveResult.success) return saveResult;

            await this.repositoryService.stageFragmentChanges(fragment.category, fragment.name);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to edit fragment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public getDisplayNameFromPathParts(pathParts: string[]): string {
        let category = '';
        let name = '';

        if (pathParts.length >= 2) {
            category = pathParts[0];
            name = pathParts[1].replace(/\.md$/, '');
        } else if (pathParts.length === 1) {
            name = pathParts[0].replace(/\.md$/, '');
        }
        return category ? `${category}/${name}` : name;
    }

    public async selectFragment(
        fragmentsResult: ApiResult<PromptFragment[]>,
        title: string = 'Select Fragment',
        emoji: string = '🧩'
    ): Promise<PromptFragment | null> {
        try {
            if (!fragmentsResult.success || !fragmentsResult.data || fragmentsResult.data.length === 0) {
                this.loggerService.warn(WARNING_MESSAGES.NO_FRAGMENTS_FOUND);
                return null;
            }

            const fragments = fragmentsResult.data;
            const sortedFragments = fragments.sort((a, b) =>
                `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`)
            );
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(title, emoji);
            const tableResult = this.tableRenderer.formatFragmentsTable(sortedFragments);
            const tableChoices = this.uiFacade.createTableMenuChoices<PromptFragment, 'back'>(tableResult, {
                infoText: `Found ${sortedFragments.length} fragments.`,
                includeGoBack: true
            });
            const fragment = await this.uiFacade.selectMenu<PromptFragment | 'back'>(
                'Use ↑↓ to select a fragment:',
                tableChoices
            );
            return fragment === 'back' ? null : (fragment as PromptFragment);
        } catch (error) {
            this.errorService.handleError(error, 'Failed to select fragment');
            return null;
        }
    }

    public async selectFragmentWithTable(title: string, emoji: string): Promise<PromptFragment | null> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(title, emoji);
            const fragmentsResult = await this.fragmentService.getAllFragments();

            if (!fragmentsResult.success || !fragmentsResult.data || fragmentsResult.data.length === 0) {
                this.loggerService.warn(WARNING_MESSAGES.NO_FRAGMENTS_FOUND);
                return null;
            }
            return await this.selectFragment(fragmentsResult, title, emoji);
        } catch (error) {
            this.errorService.handleError(error, 'Failed to select fragment');
            return null;
        }
    }

    public async selectFragmentForEditing(): Promise<ApiResult<PromptFragment>> {
        try {
            const fragment = await this.selectFragmentWithTable('Edit Fragment', '♻️');
            return fragment ? Result.success(fragment) : Result.failure('No fragment selected');
        } catch (error) {
            return Result.failure(
                `Error selecting fragment: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async selectFragmentForDeletion(): Promise<ApiResult<PromptFragment>> {
        try {
            const fragment = await this.selectFragmentWithTable('Delete Fragment', '🔥');
            return fragment ? Result.success(fragment) : Result.failure('No fragment selected');
        } catch (error) {
            return Result.failure(
                `Error selecting fragment: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
