import { processMetadataGeneration } from './metadata-generator';
import { PromptMetadata } from '../../shared/types';
import logger from '../../shared/utils/logger';

export async function analyzePrompt(promptContent: string): Promise<PromptMetadata> {
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
