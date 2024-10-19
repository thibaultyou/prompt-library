import * as path from 'path';

import { Metadata } from '../../shared/types';
import { readFileContent, readDirectory, isDirectory } from '../../shared/utils/file_operations';
import logger from '../../shared/utils/logger';
import { processPromptContent } from '../../shared/utils/prompt_operations';
import { appConfig } from '../config/app.config';
import { parseYamlContent } from '../utils/yaml_operations';

export async function loadAnalyzerPrompt(): Promise<string> {
    logger.info(`Loading analyzer prompt from ${appConfig.ANALYZER_PROMPT_PATH}`);
    const content = await readFileContent(appConfig.ANALYZER_PROMPT_PATH);
    logger.info(`Analyzer prompt loaded, length: ${content.length} characters`);
    return content;
}

export async function processMetadataGeneration(promptContent: string): Promise<Metadata> {
    logger.info('Processing prompt for metadata generation');

    try {
        const analyzerPrompt = await loadAnalyzerPrompt();
        const availableFragments = await listAvailableFragments();
        const variables = {
            PROMPT_TO_ANALYZE: promptContent,
            AVAILABLE_PROMPT_FRAGMENTS: availableFragments
        };
        const content = await processPromptContent(analyzerPrompt, variables, false);
        const yamlContent = extractOutputContent(content);
        return parseYamlContent(yamlContent);
    } catch (error) {
        logger.error('Error in processMetadataGeneration:', error);
        throw error;
    }
}

export function extractOutputContent(content: string): string {
    const outputStart = content.indexOf('<output>');
    const outputEnd = content.indexOf('</output>');
    return outputStart !== -1 && outputEnd !== -1 ? content.slice(outputStart + 8, outputEnd).trim() : content.trim();
}

export async function listAvailableFragments(): Promise<string> {
    const fragmentsDir = path.join(appConfig.FRAGMENTS_DIR);
    const categories = await readDirectory(fragmentsDir);
    const fragments: Record<string, string[]> = {};

    for (const category of categories) {
        const categoryPath = path.join(fragmentsDir, category);

        if (await isDirectory(categoryPath)) {
            const categoryFragments = await readDirectory(categoryPath);
            fragments[category] = categoryFragments.map((f) => path.parse(f).name);
        }
    }
    return JSON.stringify(fragments, null, 2);
}
