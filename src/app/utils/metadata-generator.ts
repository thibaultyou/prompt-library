import { listAvailableFragments } from './fragment-manager';
import { parseYamlContent } from './yaml-operations';
import { PromptMetadata } from '../../shared/types';
import { readFileContent } from '../../shared/utils/file-system';
import logger from '../../shared/utils/logger';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt-processing';
import { appConfig } from '../config/app-config';

export async function loadAnalyzerPrompt(): Promise<string> {
    try {
        logger.info(`Loading analyzer prompt from ${appConfig.ANALYZER_PROMPT_PATH}`);
        const content = await readFileContent(appConfig.ANALYZER_PROMPT_PATH);
        logger.info(`Analyzer prompt loaded, length: ${content.length} characters`);
        return content;
    } catch (error) {
        logger.error('Error loading analyzer prompt:', error);
        throw error;
    }
}

export async function processMetadataGeneration(promptContent: string): Promise<PromptMetadata> {
    logger.info('Processing prompt for metadata generation');

    try {
        const [analyzerPrompt, availableFragments] = await Promise.all([
            loadAnalyzerPrompt(),
            listAvailableFragments()
        ]);
        const variables = {
            PROMPT_TO_ANALYZE: promptContent,
            AVAILABLE_PROMPT_FRAGMENTS: availableFragments
        };
        const updatedPromptContent = updatePromptWithVariables(analyzerPrompt, variables);
        const content = await processPromptContent([{ role: 'user', content: updatedPromptContent }], false);
        const yamlContent = extractOutputContent(content);
        const parsedMetadata = parseYamlContent(yamlContent);
        const metadata: PromptMetadata = {
            title: parsedMetadata.title || '',
            primary_category: parsedMetadata.primary_category || '',
            subcategories: parsedMetadata.subcategories || [],
            directory: parsedMetadata.directory || '',
            tags: parsedMetadata.tags || [],
            one_line_description: parsedMetadata.one_line_description || '',
            description: parsedMetadata.description || '',
            variables: parsedMetadata.variables || [],
            content_hash: parsedMetadata.content_hash,
            fragments: parsedMetadata.fragments
        };

        if (!isValidMetadata(metadata)) {
            throw new Error('Invalid metadata generated');
        }
        return metadata;
    } catch (error) {
        logger.error('Error in processMetadataGeneration:', error);
        throw error;
    }
}

function extractOutputContent(content: string): string {
    const outputStart = content.indexOf('<output>');
    const outputEnd = content.indexOf('</output>');

    if (outputStart === -1 || outputEnd === -1) {
        logger.warn('Output tags not found in content, returning trimmed content');
        return content.trim();
    }
    return content.slice(outputStart + 8, outputEnd).trim();
}

function isValidMetadata(metadata: PromptMetadata): boolean {
    if (!metadata.title || !metadata.description || !metadata.primary_category) {
        logger.warn('Missing one or more required fields in metadata: title, description, or primary_category');
        return false;
    }

    if (!Array.isArray(metadata.variables) || metadata.variables.length === 0) {
        logger.warn('Metadata is missing variables or variables is not an array');
        return false;
    }
    return true;
}
