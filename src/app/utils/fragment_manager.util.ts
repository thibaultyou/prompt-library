import path from 'path';

import { isDirectory, readDirectory } from '../../shared/utils/file_system.util';
import logger from '../../shared/utils/logger.util';
import { appConfig } from '../config/app.config';

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
