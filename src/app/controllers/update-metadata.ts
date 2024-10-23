import * as crypto from 'crypto';
import * as path from 'path';

import { commonConfig } from '../../shared/config/common-config';
import { PromptMetadata } from '../../shared/types';
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
} from '../../shared/utils/file-system';
import logger from '../../shared/utils/logger';
import { appConfig } from '../config/app-config';
import { processMetadataGeneration } from '../utils/metadata-generator';
import { dumpYamlContent, sanitizeYamlContent } from '../utils/yaml-operations';

export async function generateMetadata(promptContent: string): Promise<PromptMetadata> {
    logger.info('Starting metadata generation');

    try {
        return await processMetadataGeneration(promptContent);
    } catch (error) {
        logger.error('Error in generateMetadata:', error);
        throw error;
    }
}

export async function shouldUpdateMetadata(promptFile: string, metadataFile: string): Promise<[boolean, string]> {
    const forceRegenerate = appConfig.FORCE_REGENERATE;
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

        if (!storedHashLine) {
            logger.info(`No content hash found in ${metadataFile}. Update needed.`);
            return [true, promptHash];
        }

        const storedHash = storedHashLine.split(':')[1].trim();
        const hashesMatch = promptHash === storedHash;

        if (!hashesMatch) {
            logger.info(`Content hash mismatch for ${promptFile}. Update needed.`);
            return [true, promptHash];
        }

        logger.info(`Content hash match for ${promptFile}. No update needed.`);
        return [false, promptHash];
    } catch (error) {
        logger.error(`Error reading metadata file ${metadataFile}:`, error);
        return [true, promptHash];
    }
}

export async function updateMetadataHash(metadataFile: string, newHash: string): Promise<void> {
    try {
        const content = await readFileContent(metadataFile);
        const lines = content.split('\n');
        const hashIndex = lines.findIndex((line) => line.trim().startsWith('content_hash:'));

        if (hashIndex !== -1) {
            lines[hashIndex] = `content_hash: ${newHash}`;
        } else {
            lines.push(`content_hash: ${newHash}`);
        }

        await writeFileContent(metadataFile, sanitizeYamlContent(lines.join('\n')));
        logger.info(`Content hash updated in ${metadataFile}`);
    } catch (error) {
        logger.error(`Failed to update content hash for ${metadataFile}`, error);
        throw error;
    }
}

export async function updatePromptMetadata(): Promise<void> {
    logger.info('Starting update-metadata process');

    try {
        await processMainPrompt(appConfig.PROMPTS_DIR);
        await processPromptDirectories(appConfig.PROMPTS_DIR);
        logger.info('update-metadata process completed');
    } catch (error) {
        logger.error('Error in updatePromptMetadata:', error);
        throw error;
    }
}

async function processMainPrompt(promptsDir: string): Promise<void> {
    const mainPromptFile = path.join(promptsDir, commonConfig.PROMPT_FILE_NAME);

    if (await fileExists(mainPromptFile)) {
        logger.info('Processing main prompt.md file');

        try {
            const promptContent = await readFileContent(mainPromptFile);
            const metadata = await generateMetadata(promptContent);
            const newDirName = metadata.directory;
            const newDirPath = path.join(promptsDir, newDirName);
            await createDirectory(newDirPath);
            const newPromptFile = path.join(newDirPath, commonConfig.PROMPT_FILE_NAME);
            await renameFile(mainPromptFile, newPromptFile);
            const metadataPath = path.join(newDirPath, commonConfig.METADATA_FILE_NAME);
            await writeFileContent(metadataPath, sanitizeYamlContent(dumpYamlContent(metadata)));
            const newHash = crypto.createHash('md5').update(promptContent).digest('hex');
            await updateMetadataHash(metadataPath, newHash);
        } catch (error) {
            logger.error('Error processing main prompt:', error);
            throw error;
        }
    }
}

async function processPromptDirectories(promptsDir: string): Promise<void> {
    const items = await readDirectory(promptsDir);
    await Promise.all(
        items.map(async (item) => {
            const currentItemPath = path.join(promptsDir, item);

            if (await isDirectory(currentItemPath)) {
                logger.info(`Processing directory: ${item}`);
                const promptFile = path.join(currentItemPath, commonConfig.PROMPT_FILE_NAME);
                const metadataFile = path.join(currentItemPath, commonConfig.METADATA_FILE_NAME);

                if (await fileExists(promptFile)) {
                    await processPromptFile(promptFile, metadataFile, currentItemPath, promptsDir, item);
                } else {
                    logger.warn(`No ${commonConfig.PROMPT_FILE_NAME} file found in ${currentItemPath}`);
                }
            }
        })
    );
}

async function processPromptFile(
    promptFile: string,
    metadataFile: string,
    currentItemPath: string,
    promptsDir: string,
    item: string
): Promise<void> {
    try {
        const [shouldUpdate, newHash] = await shouldUpdateMetadata(promptFile, metadataFile);

        if (shouldUpdate) {
            logger.info(`Updating metadata for ${item}`);
            const promptContent = await readFileContent(promptFile);
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

            const metadataPath = path.join(currentItemPath, commonConfig.METADATA_FILE_NAME);
            await writeFileContent(metadataPath, sanitizeYamlContent(dumpYamlContent(metadata)));
            await updateMetadataHash(metadataPath, newHash);
        } else {
            logger.info(`Metadata for ${item} is up to date`);
        }
    } catch (error) {
        logger.error(`Error processing ${item}:`, error);
        throw error;
    }
}

async function updatePromptDirectory(
    promptsDir: string,
    oldDirName: string,
    newDirName: string,
    currentItemPath: string
): Promise<void> {
    const newDirPath = path.join(promptsDir, newDirName);
    logger.info(`Renaming directory from ${oldDirName} to ${newDirName}`);

    try {
        if (await fileExists(newDirPath)) {
            logger.warn(`Directory ${newDirName} already exists. Updating contents.`);
            const files = await readDirectory(currentItemPath);

            for (const file of files) {
                const src = path.join(currentItemPath, file);
                const dst = path.join(newDirPath, file);

                if (await isFile(src)) {
                    await copyFile(src, dst);
                }
            }

            await removeDirectory(currentItemPath);
        } else {
            await renameFile(currentItemPath, newDirPath);
        }
    } catch (error) {
        logger.error(`Error updating prompt directory from ${oldDirName} to ${newDirName}:`, error);
        throw error;
    }
}

if (require.main === module) {
    updatePromptMetadata().catch((error) => {
        logger.error('Error in main execution:', error);
        process.exit(1);
    });
}
