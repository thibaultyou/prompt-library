import * as path from 'path';

import * as nunjucks from 'nunjucks';

import { commonConfig } from '../../shared/config/common.config';
import { CategoryItem, Metadata } from '../../shared/types';
import { isDirectory, readDirectory, readFileContent, writeFileContent } from '../../shared/utils/file_system.util';
import logger from '../../shared/utils/logger.util';
import { formatTitleCase } from '../../shared/utils/string_formatter.util';
import { appConfig } from '../config/app.config';
import { parseYamlContent } from '../utils/yaml_operations.util';

async function processPromptDirectory(promptDir: string, categories: Record<string, CategoryItem[]>): Promise<void> {
    const promptPath = path.join(appConfig.PROMPTS_DIR, promptDir);

    if (!(await isDirectory(promptPath))) {
        return;
    }

    logger.info(`Processing prompt directory: ${promptDir}`);
    const promptFile = path.join(promptPath, commonConfig.PROMPT_FILE_NAME);
    const metadataFile = path.join(promptPath, commonConfig.METADATA_FILE_NAME);

    try {
        const [promptContent, metadataContent] = await Promise.all([
            readFileContent(promptFile),
            readFileContent(metadataFile)
        ]);
        const metadata = parseYamlContent(metadataContent) as Metadata;
        logger.debug(`Read metadata from ${metadataFile}`);

        await generateViewFile(promptPath, metadata, promptContent);
        addPromptToCategories(categories, promptDir, metadata);
    } catch (error) {
        logger.error(`Error processing ${promptDir}:`, error);
    }
}

async function generateViewFile(promptPath: string, metadata: Metadata, promptContent: string): Promise<void> {
    try {
        const viewContent = nunjucks.render(appConfig.VIEW_TEMPLATE_NAME, {
            metadata,
            prompt_content: promptContent,
            format_string: formatTitleCase
        });
        logger.debug('Generated view content using template');

        const viewPath = path.join(promptPath, appConfig.VIEW_FILE_NAME);
        await writeFileContent(viewPath, viewContent);
        logger.info(`Wrote view content to ${viewPath}`);
    } catch (error) {
        logger.error(`Error generating view file for ${promptPath}:`, error);
        throw error;
    }
}

function addPromptToCategories(
    categories: Record<string, CategoryItem[]>,
    promptDir: string,
    metadata: Metadata
): void {
    const primaryCategory = metadata.primary_category || appConfig.DEFAULT_CATEGORY;
    categories[primaryCategory] = categories[primaryCategory] || [];
    categories[primaryCategory].push({
        id: promptDir,
        title: metadata.title || 'Untitled',
        primary_category: primaryCategory,
        description: metadata.one_line_description || 'No description',
        path: `${appConfig.PROMPTS_DIR}/${promptDir}/${appConfig.VIEW_FILE_NAME}`,
        subcategories: metadata.subcategories || []
    });
    logger.debug(`Added prompt to category: ${primaryCategory}`);
}

export async function updateViews(): Promise<void> {
    logger.info('Starting update_views process');
    const categories: Record<string, CategoryItem[]> = {};

    try {
        logger.info('Setting up Nunjucks environment');
        nunjucks.configure(appConfig.TEMPLATES_DIR, { autoescape: false });
        logger.info('Nunjucks environment configured');

        logger.info(`Iterating through prompts in ${appConfig.PROMPTS_DIR}`);
        const promptDirs = await readDirectory(appConfig.PROMPTS_DIR);
        await Promise.all(promptDirs.map((promptDir) => processPromptDirectory(promptDir, categories)));

        await generateReadme(categories);
        logger.info('update_views process completed');
    } catch (error) {
        logger.error('Error in updateViews:', error);
        throw error;
    }
}

async function generateReadme(categories: Record<string, CategoryItem[]>): Promise<void> {
    try {
        const sortedCategories = Object.fromEntries(
            Object.entries(categories)
                .filter(([, v]) => v.length > 0)
                .sort(([a], [b]) => a.localeCompare(b))
        );
        logger.info('Generating README content');
        const readmeContent = nunjucks.render(appConfig.README_TEMPLATE_NAME, {
            categories: sortedCategories,
            format_string: formatTitleCase
        });
        const formattedContent = readmeContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
        await writeFileContent(appConfig.README_PATH, formattedContent);
        logger.info(`Wrote README content to ${appConfig.README_PATH}`);
    } catch (error) {
        logger.error('Error generating README:', error);
        throw error;
    }
}

if (require.main === module) {
    updateViews().catch((error) => {
        logger.error('Error in main execution:', error);
        process.exit(1);
    });
}
