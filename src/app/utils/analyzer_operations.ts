import * as path from 'path';

import { Metadata } from '../../shared/types';
import { readFileContent, readDirectory, isDirectory } from '../../shared/utils/file_operations';
import logger from '../../shared/utils/logger';
import { processPromptContent } from '../../shared/utils/prompt_operations';
import { appConfig } from '../config/app.config';
import { parseYamlContent } from '../utils/yaml_operations';

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

export async function processMetadataGeneration(promptContent: string): Promise<Metadata> {
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
        const content = await processPromptContent([{ role: 'user', content: analyzerPrompt }], variables, false);
        const yamlContent = extractOutputContent(content);
        const parsedMetadata = parseYamlContent(yamlContent);
        const metadata: Metadata = {
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

export async function listAvailableFragments(): Promise<string> {
    try {
        logger.info('Listing available fragments');
        const fragmentsDir = path.join(appConfig.FRAGMENTS_DIR);
        const categories = await readDirectory(fragmentsDir);
        const fragments: Record<string, string[]> = {};
        await Promise.all(
            categories.map(async (category) => {
                const categoryPath = path.join(fragmentsDir, category);

                if (await isDirectory(categoryPath)) {
                    const categoryFragments = await readDirectory(categoryPath);
                    fragments[category] = categoryFragments.map((f) => path.parse(f).name);
                    logger.debug(`Found ${fragments[category].length} fragments in category ${category}`);
                }
            })
        );

        logger.info(`Listed fragments from ${Object.keys(fragments).length} categories`);
        return JSON.stringify(fragments, null, 2);
    } catch (error) {
        logger.error('Error listing available fragments:', error);
        throw error;
    }
}

function isValidMetadata(metadata: Metadata): boolean {
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

export async function analyzePrompt(promptContent: string): Promise<Metadata> {
    try {
        logger.info('Starting prompt analysis');
        const metadata = await processMetadataGeneration(promptContent);
        logger.info('Prompt analysis completed successfully');
        return metadata;
    } catch (error) {
        logger.error('Error analyzing prompt:', error);
        throw error;
    }
}

if (require.main === module) {
    // This block will be executed if the script is run directly
    const promptPath = process.argv[2];

    if (!promptPath) {
        console.error('Please provide a path to the prompt file as an argument');
        process.exit(1);
    }

    readFileContent(promptPath)
        .then(analyzePrompt)
        .then((metadata) => {
            console.log('Generated Metadata:');
            console.log(JSON.stringify(metadata, null, 2));
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}
