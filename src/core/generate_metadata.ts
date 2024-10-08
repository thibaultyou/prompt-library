import * as crypto from 'crypto';
import * as path from 'path';

import { Anthropic } from '@anthropic-ai/sdk';
import { Message } from '@anthropic-ai/sdk/resources';

import config from '@config';
import { Metadata } from '@types';
import { initializeAnthropicClient, sendAnthropicRequest } from '@utils/anthropic_client';
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
    writeFileContent
} from '@utils/file_operations';
import logger from '@utils/logger';
import { dumpYamlContent, parseYamlContent, sanitizeYamlContent } from '@utils/yaml_operations';

/**
 * Loads the analyzer prompt from the specified file.
 * @returns {Promise<string>} The content of the analyzer prompt.
 */
async function loadAnalyzerPrompt(): Promise<string> {
    logger.info(`Loading analyzer prompt from ${config.ANALYZER_PROMPT_PATH}`);
    const content = await readFileContent(config.ANALYZER_PROMPT_PATH);
    logger.info(`Analyzer prompt loaded, length: ${content.length} characters`);
    return content;
}

/**
 * Extracts the content from an Anthropic API message.
 * @param {Message} message - The message object from the Anthropic API.
 * @returns {string} The extracted content as a string.
 */
function extractContentFromMessage(message: Message): string {
    if (!message.content || message.content.length === 0) {
        return '';
    }
    return message.content
        .map((block) => {
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
 * @param {string} content - The string containing YAML content.
 * @returns {string} The extracted YAML content.
 */
function extractYamlContent(content: string): string {
    const outputStart = content.indexOf('<output>');
    const outputEnd = content.indexOf('</output>');
    return outputStart !== -1 && outputEnd !== -1 ? content.slice(outputStart + 8, outputEnd).trim() : content.trim();
}

/**
 * Processes the prompt content using the Anthropic API and generates metadata.
 * @param {Anthropic} client - The Anthropic API client.
 * @param {string} analyzerPrompt - The analyzer prompt.
 * @param {string} promptContent - The content of the prompt to analyze.
 * @returns {Promise<Metadata>} The generated metadata.
 */
async function processPromptContent(
    client: Anthropic,
    analyzerPrompt: string,
    promptContent: string
): Promise<Metadata> {
    const message = await sendAnthropicRequest(client, analyzerPrompt.replace('{{PROMPT}}', promptContent));
    const content = extractContentFromMessage(message);
    const yamlContent = extractYamlContent(content);
    return parseYamlContent(yamlContent);
}

/**
 * Generates metadata for a given prompt content.
 * @param {string} promptContent - The content of the prompt.
 * @returns {Promise<Metadata>} The generated metadata.
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
 * @param {string} promptFile - Path to the prompt file.
 * @param {string} metadataFile - Path to the metadata file.
 * @returns {Promise<[boolean, string]>} A tuple indicating if update is needed and the new hash.
 */
export async function shouldUpdateMetadata(promptFile: string, metadataFile: string): Promise<[boolean, string]> {
    const forceRegenerate = config.FORCE_REGENERATE.toLowerCase() === 'true';
    const promptContent = await readFileContent(promptFile);
    const promptHash = crypto.createHash('md5').update(promptContent).digest('hex');

    if (forceRegenerate) {
        logger.info('Forcing metadata regeneration due to system prompt changes.');
        return [true, promptHash];
    }

    if (!(await fileExists(metadataFile))) {
        logger.info(`Metadata file ${metadataFile} does not exist. Update needed.`);
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
        logger.error(`Error reading metadata file ${metadataFile}:`, error);
        return [true, promptHash];
    }
}

/**
 * Updates the content hash in the metadata file.
 * @param {string} metadataFile - Path to the metadata file.
 * @param {string} newHash - The new hash to be updated.
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
 * @param {string} promptsDir - The directory containing prompts.
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
 * @param {string} promptsDir - The directory containing prompts.
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
        })
    );
}

/**
 * Processes a single prompt file and updates its metadata if necessary.
 * @param {string} promptFile - Path to the prompt file.
 * @param {string} metadataFile - Path to the metadata file.
 * @param {string} currentItemPath - Current directory path of the prompt.
 * @param {string} promptsDir - The directory containing all prompts.
 * @param {string} item - The name of the current prompt directory.
 */
async function processPromptFile(
    promptFile: string,
    metadataFile: string,
    currentItemPath: string,
    promptsDir: string,
    item: string
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
            await updateMetadataHash(metadataPath, newHash);
        } catch (error) {
            logger.error(`Error processing ${item}:`, error);
        }
    } else {
        logger.info(`Metadata for ${item} is up to date`);
    }
}

/**
 * Updates the prompt directory name if it has changed.
 * @param {string} promptsDir - The directory containing all prompts.
 * @param {string} oldDirName - The current directory name.
 * @param {string} newDirName - The new directory name.
 * @param {string} currentItemPath - The current path of the prompt directory.
 */
async function updatePromptDirectory(
    promptsDir: string,
    oldDirName: string,
    newDirName: string,
    currentItemPath: string
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
            })
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
