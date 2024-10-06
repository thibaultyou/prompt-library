import {
    copyFile,
    createDirectory,
    fileExists,
    isDirectory,
    isFile,
    readDirectory,
    readFileContent,
    removeDirectory,
    renameFile,
    writeFileContent,
} from './utils/file_operations';
import { initializeAnthropicClient, sendAnthropicRequest } from './utils/anthropic_client';
import { parseYamlContent, dumpYamlContent, sanitizeYamlContent } from './utils/yaml_operations';
import { Metadata } from './types/metadata';
import * as path from 'path';
import * as crypto from 'crypto';
import { ContentBlock, Message } from '@anthropic-ai/sdk/resources';
import config from './config';
import logger from './utils/logger';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Loads the analyzer prompt from the specified file.
 * @returns The content of the analyzer prompt.
 */
async function loadAnalyzerPrompt(): Promise<string> {
    logger.info(`Loading analyzer prompt from ${config.ANALYZER_PROMPT_PATH}`);
    const content = await readFileContent(config.ANALYZER_PROMPT_PATH);
    logger.info(`Analyzer prompt loaded, length: ${content.length} characters`);
    return content;
}

/**
 * Extracts the content from an Anthropic API message.
 * @param message - The message object from the Anthropic API.
 * @returns The extracted content as a string.
 */
function extractContentFromMessage(message: Message): string {
    if (!message.content || message.content.length === 0) {
        return '';
    }

    return message.content
        .map((block: ContentBlock) => {
            if (block.type === 'text') {
                return block.text;
            } else if (block.type === 'tool_use') {
                return `[Tool Use: ${block.name}]\nInput: ${JSON.stringify(block.input)}`;
            }
            return JSON.stringify(block);
        })
        .join('\n');
}

/**
 * Extracts YAML content from a string between <output> tags.
 * @param content - The string containing YAML content.
 * @returns The extracted YAML content.
 */
function extractYamlContent(content: string): string {
    const outputStart = content.indexOf('<output>');
    const outputEnd = content.indexOf('</output>');
    return outputStart !== -1 && outputEnd !== -1 ? content.slice(outputStart + 8, outputEnd).trim() : content.trim();
}

/**
 * Processes the prompt content using the Anthropic API and generates metadata.
 * @param client - The Anthropic API client.
 * @param analyzerPrompt - The analyzer prompt.
 * @param promptContent - The content of the prompt to analyze.
 * @returns The generated metadata.
 */
async function processPromptContent(
    client: Anthropic,
    analyzerPrompt: string,
    promptContent: string,
): Promise<Metadata> {
    const message = await sendAnthropicRequest(client, analyzerPrompt.replace('{{PROMPT}}', promptContent));
    const content = extractContentFromMessage(message);
    const yamlContent = extractYamlContent(content);
    return parseYamlContent(yamlContent);
}

/**
 * Generates metadata for a given prompt content.
 * @param promptContent - The content of the prompt.
 * @returns The generated metadata.
 */
export async function generateMetadata(promptContent: string): Promise<Metadata> {
    logger.info('Starting metadata generation');

    const client = initializeAnthropicClient();
    logger.info('Anthropic client initialized');

    try {
        const analyzerPrompt = await loadAnalyzerPrompt();
        return await processPromptContent(client, analyzerPrompt, promptContent);
    } catch (error) {
        logger.error('Error in generateMetadata:', error);
        throw error;
    }
}

/**
 * Determines if metadata should be updated based on content hash.
 * @param promptFile - Path to the prompt file.
 * @param metadataFile - Path to the metadata file.
 * @returns A tuple indicating if update is needed and the new hash.
 */
export async function shouldUpdateMetadata(promptFile: string, metadataFile: string): Promise<[boolean, string]> {
    const forceRegenerate = process.env[config.FORCE_REGENERATE_ENV_VAR]?.toLowerCase() === 'true';

    const promptContent = await readFileContent(promptFile);
    const promptHash = crypto.createHash('md5').update(promptContent).digest('hex');

    if (forceRegenerate) {
        logger.info('Forcing metadata regeneration due to system prompt changes.');
        return [true, promptHash];
    }

    try {
        const metadataContent = await readFileContent(metadataFile);
        const storedHashLine = metadataContent.split('\n').find((line) => line.trim().startsWith('content_hash:'));

        if (storedHashLine) {
            const storedHash = storedHashLine.split(':')[1].trim();
            if (promptHash !== storedHash) {
                logger.info(`Content hash mismatch for ${promptFile}. Update needed.`);
                return [true, promptHash];
            }
        } else {
            logger.info(`No content hash found in ${metadataFile}. Update needed.`);
            return [true, promptHash];
        }

        logger.info(`Content hash match for ${promptFile}. No update needed.`);
        return [false, promptHash];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            logger.info(`Metadata file ${metadataFile} does not exist. Update needed.`);
            return [true, promptHash];
        }
        throw error;
    }
}

/**
 * Updates the content hash in the metadata file.
 * @param metadataFile - Path to the metadata file.
 * @param newHash - The new hash to be updated.
 */
export async function updateMetadataHash(metadataFile: string, newHash: string): Promise<void> {
    try {
        const content = await readFileContent(metadataFile);
        const lines = content.split('\n');

        let hashUpdated = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('content_hash:')) {
                lines[i] = `content_hash: ${newHash}`;
                hashUpdated = true;
                break;
            }
        }
        if (!hashUpdated) {
            lines.push(`content_hash: ${newHash}`);
        }
        await writeFileContent(metadataFile, sanitizeYamlContent(lines.join('\n')));
        logger.info(`Content hash updated in ${metadataFile}`);
    } catch (error) {
        logger.error(`Failed to update content hash for ${metadataFile}`, error);
        throw error;
    }
}

/**
 * Updates metadata for all prompts in the library.
 */
export async function updatePromptMetadata(): Promise<void> {
    logger.info('Starting update_prompt_metadata process');

    await processMainPrompt(config.PROMPTS_DIR);
    await processPromptDirectories(config.PROMPTS_DIR);

    logger.info('update_prompt_metadata process completed');
}

/**
 * Processes the main prompt file if it exists.
 * @param promptsDir - The directory containing prompts.
 */
async function processMainPrompt(promptsDir: string): Promise<void> {
    const mainPromptFile = path.join(promptsDir, config.PROMPT_FILE_NAME);
    if (await fileExists(mainPromptFile)) {
        logger.info('Processing main prompt.md file');
        const promptContent = await readFileContent(mainPromptFile);
        const metadata = await generateMetadata(promptContent);
        const newDirName = metadata.directory;
        const newDirPath = path.join(promptsDir, newDirName);

        await createDirectory(newDirPath);
        const newPromptFile = path.join(newDirPath, config.PROMPT_FILE_NAME);
        await renameFile(mainPromptFile, newPromptFile);

        const metadataPath = path.join(newDirPath, config.METADATA_FILE_NAME);
        await writeFileContent(metadataPath, sanitizeYamlContent(dumpYamlContent(metadata)));

        const newHash = crypto.createHash('md5').update(promptContent).digest('hex');
        await updateMetadataHash(metadataPath, newHash);
    }
}

/**
 * Processes all prompt directories in the library.
 * @param promptsDir - The directory containing prompts.
 */
async function processPromptDirectories(promptsDir: string): Promise<void> {
    const items = await readDirectory(promptsDir);
    await Promise.all(
        items.map(async (item) => {
            const currentItemPath = path.join(promptsDir, item);

            if (await isDirectory(currentItemPath)) {
                logger.info(`Processing directory: ${item}`);
                const promptFile = path.join(currentItemPath, config.PROMPT_FILE_NAME);
                const metadataFile = path.join(currentItemPath, config.METADATA_FILE_NAME);

                if (await fileExists(promptFile)) {
                    await processPromptFile(promptFile, metadataFile, currentItemPath, promptsDir, item);
                } else {
                    logger.warn(`No ${config.PROMPT_FILE_NAME} file found in ${currentItemPath}`);
                }
            }
        }),
    );
}

/**
 * Processes a single prompt file and updates its metadata if necessary.
 * @param promptFile - Path to the prompt file.
 * @param metadataFile - Path to the metadata file.
 * @param currentItemPath - Current directory path of the prompt.
 * @param promptsDir - The directory containing all prompts.
 * @param item - The name of the current prompt directory.
 */
async function processPromptFile(
    promptFile: string,
    metadataFile: string,
    currentItemPath: string,
    promptsDir: string,
    item: string,
): Promise<void> {
    const [shouldUpdate, newHash] = await shouldUpdateMetadata(promptFile, metadataFile);
    if (shouldUpdate) {
        logger.info(`Updating metadata for ${item}`);
        const promptContent = await readFileContent(promptFile);

        try {
            const metadata = await generateMetadata(promptContent);
            if (!metadata || Object.keys(metadata).length === 0) {
                logger.warn(`Failed to generate metadata for ${item}. Skipping.`);
                return;
            }
            const newDirName = metadata.directory;

            if (newDirName !== item) {
                await updatePromptDirectory(promptsDir, item, newDirName, currentItemPath);
                currentItemPath = path.join(promptsDir, newDirName);
            }

            const metadataPath = path.join(currentItemPath, config.METADATA_FILE_NAME);
            await writeFileContent(metadataPath, sanitizeYamlContent(dumpYamlContent(metadata)));

            await updateMetadataHash(
                metadataPath,
                newHash || crypto.createHash('md5').update(promptContent).digest('hex'),
            );
        } catch (error) {
            logger.error(`Error processing ${item}:`, error);
        }
    } else {
        logger.info(`Metadata for ${item} is up to date`);
    }
}

/**
 * Updates the prompt directory name if it has changed.
 * @param promptsDir - The directory containing all prompts.
 * @param oldDirName - The current directory name.
 * @param newDirName - The new directory name.
 * @param currentItemPath - The current path of the prompt directory.
 */
async function updatePromptDirectory(
    promptsDir: string,
    oldDirName: string,
    newDirName: string,
    currentItemPath: string,
): Promise<void> {
    const newDirPath = path.join(promptsDir, newDirName);
    logger.info(`Renaming directory from ${oldDirName} to ${newDirName}`);
    if (await fileExists(newDirPath)) {
        logger.warn(`Directory ${newDirName} already exists. Updating contents.`);
        const files = await readDirectory(currentItemPath);
        await Promise.all(
            files.map(async (file) => {
                const src = path.join(currentItemPath, file);
                const dst = path.join(newDirPath, file);
                if (await isFile(src)) {
                    await copyFile(src, dst);
                }
            }),
        );
        await removeDirectory(currentItemPath);
    } else {
        await renameFile(currentItemPath, newDirPath);
    }
}

if (require.main === module) {
    updatePromptMetadata().catch((error) => {
        logger.error('Error in main execution:', error);
        process.exit(1);
    });
}
