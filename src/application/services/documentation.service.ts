import path from 'path';

import { Injectable, Inject } from '@nestjs/common';
import nunjucks from 'nunjucks';

import { IPromptMetadataRepository } from '../../core/prompt/repositories/prompt-metadata.repository.interface';
import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import { FileSystemService } from '../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { appConfig } from '../../shared/config';
import { ApiResult, CategoryItem, PromptMetadata, Result } from '../../shared/types';

@Injectable()
export class DocumentationService {
    constructor(
        @Inject(IPromptMetadataRepository) private readonly metadataRepo: IPromptMetadataRepository,
        private readonly loggerService: LoggerService,
        private readonly fsService: FileSystemService,
        private readonly stringFormatterService: StringFormatterService
    ) {
        nunjucks.configure(appConfig.TEMPLATES_DIR, { autoescape: false });
    }

    public async generateDocumentation(): Promise<ApiResult<void>> {
        this.loggerService.info('Starting documentation generation (update-views logic)...');
        const categories: Record<string, CategoryItem[]> = {};

        try {
            const allPromptsResult = await this.metadataRepo.getAllPromptsList();

            if (!allPromptsResult.success || !allPromptsResult.data) {
                return Result.failure('Failed to retrieve prompts for documentation generation.');
            }

            const allPrompts = allPromptsResult.data;

            for (const prompt of allPrompts) {
                const promptFiles = await this.getPromptFiles(prompt.id);

                if (promptFiles) {
                    await this.generateIndividualPromptView(
                        prompt.path,
                        promptFiles.metadata,
                        promptFiles.promptContent
                    );
                    this.addPromptToCategories(categories, prompt.path, promptFiles.metadata);
                } else {
                    this.loggerService.warn(`Skipping documentation for prompt ID ${prompt.id} (files not found).`);
                }
            }

            await this.generateMainReadme(categories);
            this.loggerService.info('Documentation generation completed successfully.');
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error during documentation generation: ${message}`);
            return Result.failure(`Documentation generation failed: ${message}`);
        }
    }

    private async getPromptFiles(
        promptId: string
    ): Promise<{ promptContent: string; metadata: PromptMetadata } | null> {
        try {
            const metadataResult = await this.metadataRepo.getPromptMetadata(promptId);

            if (!metadataResult.success || !metadataResult.data) {
                this.loggerService.warn(`Could not get metadata for prompt ID ${promptId}`);
                return null;
            }

            const metadata = metadataResult.data;
            const promptPath = path.join(appConfig.PROMPTS_DIR, metadata.directory, 'prompt.md');
            const contentResult = await this.fsService.readFileContent(promptPath);

            if (!contentResult.success || !contentResult.data) {
                this.loggerService.warn(`Could not read prompt content for ${metadata.directory}`);
                return null;
            }
            return { promptContent: contentResult.data, metadata };
        } catch (error) {
            this.loggerService.error(`Error getting files for prompt ID ${promptId}: ${error}`);
            return null;
        }
    }

    private async generateIndividualPromptView(
        promptDir: string,
        metadata: PromptMetadata,
        promptContent: string
    ): Promise<void> {
        try {
            const promptPath = path.join(appConfig.PROMPTS_DIR, promptDir);
            const viewContent = nunjucks.render(appConfig.VIEW_TEMPLATE_NAME, {
                metadata,
                prompt_content: promptContent,
                format_string: this.stringFormatterService.formatTitleCase.bind(this.stringFormatterService)
            });
            this.loggerService.debug(`Generated view content for ${promptDir}`);
            const viewPath = path.join(promptPath, appConfig.VIEW_FILE_NAME);
            await this.fsService.writeFileContent(viewPath, viewContent);
            this.loggerService.info(`Wrote view content to ${viewPath}`);
        } catch (error) {
            this.loggerService.error(`Error generating view file for ${promptDir}:`, error);
            throw error;
        }
    }

    private addPromptToCategories(
        categories: Record<string, CategoryItem[]>,
        promptDir: string,
        metadata: PromptMetadata
    ): void {
        const primaryCategory = metadata.primary_category || appConfig.DEFAULT_CATEGORY;
        categories[primaryCategory] = categories[primaryCategory] || [];
        categories[primaryCategory].push({
            id: metadata.id || promptDir,
            title: metadata.title || 'Untitled',
            primary_category: primaryCategory,
            description: metadata.one_line_description || 'No description',
            path: `${promptDir}/${appConfig.VIEW_FILE_NAME}`,
            subcategories: metadata.subcategories || []
        });
        this.loggerService.debug(`Added prompt ${metadata.title} to category: ${primaryCategory}`);
    }

    private async generateMainReadme(categories: Record<string, CategoryItem[]>): Promise<void> {
        try {
            const sortedCategories = Object.fromEntries(
                Object.entries(categories)
                    .filter(([, v]) => v.length > 0)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([category, items]) => [category, items.sort((a, b) => a.title.localeCompare(b.title))])
            );
            this.loggerService.info('Generating main README content');
            const readmeContent = nunjucks.render(appConfig.README_TEMPLATE_NAME, {
                categories: sortedCategories,
                format_string: this.stringFormatterService.formatTitleCase.bind(this.stringFormatterService)
            });
            const formattedContent = readmeContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
            await this.fsService.writeFileContent(appConfig.README_PATH, formattedContent);
            this.loggerService.info(`Wrote main README content to ${appConfig.README_PATH}`);
        } catch (error) {
            this.loggerService.error('Error generating main README:', error);
            throw error;
        }
    }
}
