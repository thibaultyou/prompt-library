import * as path from 'path';

import * as nunjucks from 'nunjucks';

import { commonConfig } from '../../shared/config/common.config';
import { CategoryItem, Metadata } from '../../shared/types';
import { isDirectory, readDirectory, readFileContent, writeFileContent } from '../../shared/utils/file_operations';
import logger from '../../shared/utils/logger';
import { formatTitleCase } from '../../shared/utils/string_formatter';
import { appConfig } from '../config/app.config';
import { parseYamlContent } from '../utils/yaml_operations';

/**
 * Processes a single prompt directory.
 * @param {string} promptDir - The name of the prompt directory.
 * @param {Record<string, CategoryItem[]>} categories - The object to store categorized prompts.
 */
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

        const viewContent = nunjucks.render(appConfig.VIEW_TEMPLATE_NAME, {
            metadata,
            prompt_content: promptContent,
            format_string: formatTitleCase
        });
        logger.debug('Generated view content using template');

        const viewPath = path.join(promptPath, appConfig.VIEW_FILE_NAME);
        await writeFileContent(viewPath, viewContent);
        logger.info(`Wrote view content to ${viewPath}`);

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
    } catch (error) {
        logger.error(`Error processing ${promptDir}:`, error);
    }
}

/**
 * Updates views for all prompts and generates the README.
 * This function processes all prompt directories, generates view files,
 * and updates the main README with categorized prompts.
 */
export async function updateViews(): Promise<void> {
    logger.info('Starting update_views process');
    const categories: Record<string, CategoryItem[]> = {};
    logger.info('Setting up Nunjucks environment');
    nunjucks.configure(appConfig.TEMPLATES_DIR, { autoescape: false });
    logger.info('Nunjucks environment configured');
    logger.info(`Iterating through prompts in ${appConfig.PROMPTS_DIR}`);
    const promptDirs = await readDirectory(appConfig.PROMPTS_DIR);
    await Promise.all(promptDirs.map((promptDir) => processPromptDirectory(promptDir, categories)));
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
    await writeFileContent(appConfig.README_PATH, readmeContent.replace(/\n{3,}/g, '\n\n').trim() + '\n');
    logger.info(`Wrote README content to ${appConfig.README_PATH}`);
    logger.info('update_views process completed');
}

// Main execution
if (require.main === module) {
    updateViews().catch((error) => {
        logger.error('Error in main execution:', error);
        process.exit(1);
    });
}
