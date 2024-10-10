import * as path from 'path';

import * as nunjucks from 'nunjucks';

import config from '@config';
import { Metadata } from '@types';
import { isDirectory, readDirectory, readFileContent, writeFileContent } from '@utils/file_operations';
import logger from '@utils/logger';
import { parseYamlContent } from '@utils/yaml_operations';

/**
 * Represents an item in a category.
 */
interface CategoryItem {
    title: string;
    description: string;
    path: string;
    subcategories: string[];
}

/**
 * Formats a string by capitalizing each word and replacing underscores with spaces.
 * @param {string} str - The string to format.
 * @returns {string} The formatted string.
 */
function formatString(str: string): string {
    return str
        .replace(/_/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Processes a single prompt directory.
 * @param {string} promptDir - The name of the prompt directory.
 * @param {Record<string, CategoryItem[]>} categories - The object to store categorized prompts.
 */
async function processPromptDirectory(promptDir: string, categories: Record<string, CategoryItem[]>): Promise<void> {
    const promptPath = path.join(config.PROMPTS_DIR, promptDir);

    if (!(await isDirectory(promptPath))) {
        return;
    }

    logger.info(`Processing prompt directory: ${promptDir}`);
    const promptFile = path.join(promptPath, config.PROMPT_FILE_NAME);
    const metadataFile = path.join(promptPath, config.METADATA_FILE_NAME);

    try {
        const [promptContent, metadataContent] = await Promise.all([
            readFileContent(promptFile),
            readFileContent(metadataFile)
        ]);
        const metadata = parseYamlContent(metadataContent) as Metadata;
        logger.debug(`Read metadata from ${metadataFile}`);

        const viewContent = nunjucks.render(config.VIEW_TEMPLATE_NAME, {
            metadata,
            prompt_content: promptContent,
            format_string: formatString
        });
        logger.debug('Generated view content using template');

        const viewPath = path.join(promptPath, config.VIEW_FILE_NAME);
        await writeFileContent(viewPath, viewContent);
        logger.info(`Wrote view content to ${viewPath}`);

        const primaryCategory = metadata.primary_category || config.DEFAULT_CATEGORY;
        categories[primaryCategory] = categories[primaryCategory] || [];
        categories[primaryCategory].push({
            title: metadata.title || 'Untitled',
            description: metadata.one_line_description || 'No description',
            path: `${config.PROMPTS_DIR}/${promptDir}/${config.VIEW_FILE_NAME}`,
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
    nunjucks.configure(config.TEMPLATES_DIR, { autoescape: false });
    logger.info('Nunjucks environment configured');
    logger.info(`Iterating through prompts in ${config.PROMPTS_DIR}`);
    const promptDirs = await readDirectory(config.PROMPTS_DIR);
    await Promise.all(promptDirs.map((promptDir) => processPromptDirectory(promptDir, categories)));
    const sortedCategories = Object.fromEntries(
        Object.entries(categories)
            .filter(([, v]) => v.length > 0)
            .sort(([a], [b]) => a.localeCompare(b))
    );
    logger.info('Generating README content');
    const readmeContent = nunjucks.render(config.README_TEMPLATE_NAME, {
        categories: sortedCategories,
        format_string: formatString
    });
    await writeFileContent(config.README_PATH, readmeContent.replace(/\n{3,}/g, '\n\n').trim() + '\n');
    logger.info(`Wrote README content to ${config.README_PATH}`);
    logger.info('update_views process completed');
}

// Main execution
if (require.main === module) {
    updateViews().catch((error) => {
        logger.error('Error in main execution:', error);
        process.exit(1);
    });
}
