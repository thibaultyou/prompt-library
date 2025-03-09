import path from 'path';

import fs from 'fs-extra';
import yaml from 'js-yaml';
import NodeCache from 'node-cache';
import sqlite3, { RunResult } from 'sqlite3';

import { AppError, handleError } from './errors';
import { createPrompt } from './prompts';
import { commonConfig } from '../../shared/config/common-config';
import { ApiResult, CategoryItem, PromptMetadata, PromptVariable } from '../../shared/types';
import { fileExists, readDirectory, readFileContent } from '../../shared/utils/file-system';
import logger from '../../shared/utils/logger';
import { cliConfig } from '../config/cli-config';

const db = new sqlite3.Database(cliConfig.DB_PATH);

export const cache = new NodeCache({ stdTTL: 600 });

export async function runAsync(sql: string, params: any[] = []): Promise<ApiResult<RunResult>> {
    return new Promise((resolve) => {
        db.run(sql, params, function (this: RunResult, err) {
            if (err) {
                handleError(new AppError('DB_ERROR', err.message), 'runAsync');
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, data: this });
            }
        });
    });
}

export function getAsync<T = any>(sql: string, params: any[] = []): Promise<ApiResult<T>> {
    return new Promise((resolve) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                handleError(new AppError('DB_ERROR', err.message), 'getAsync');
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, data: row as T });
            }
        });
    });
}

export function allAsync<T = any>(sql: string, params: any[] = []): Promise<ApiResult<T[]>> {
    return new Promise((resolve) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                handleError(new AppError('DB_ERROR', err.message), 'allAsync');
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, data: rows as T[] });
            }
        });
    });
}

export async function handleApiResult<T>(result: ApiResult<T>, message: string): Promise<T | null> {
    if (result.success && result.data) {
        return result.data;
    } else {
        handleError(result.error || 'Unknown error', `API call in ${message}`);
        return null;
    }
}

export async function getCachedOrFetch<T>(
    key: string,
    fetchFn: () => Promise<ApiResult<T>>,
    cacheInstance: NodeCache = cache
): Promise<ApiResult<T>> {
    const cachedResult = cacheInstance.get<T>(key);

    if (cachedResult !== undefined) {
        return { success: true, data: cachedResult };
    }

    const result = await fetchFn();

    if (result.success && result.data) {
        cacheInstance.set(key, result.data);
    }
    return result;
}

export async function initDatabase(): Promise<ApiResult<void>> {
    try {
        await fs.ensureDir(path.dirname(cliConfig.DB_PATH));

        const tables = [
            `CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                primary_category TEXT NOT NULL,
                directory TEXT NOT NULL,
                one_line_description TEXT,
                description TEXT,
                content_hash TEXT,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS subcategories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER,
                name TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts (id)
            )`,
            `CREATE TABLE IF NOT EXISTS variables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                optional_for_user BOOLEAN NOT NULL,
                value TEXT DEFAULT '',
                FOREIGN KEY (prompt_id) REFERENCES prompts (id)
            )`,
            `CREATE TABLE IF NOT EXISTS fragments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                variable TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (prompt_id) REFERENCES prompts (id)
            )`,
            `CREATE TABLE IF NOT EXISTS env_vars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                scope TEXT NOT NULL,
                prompt_id INTEGER,
                FOREIGN KEY (prompt_id) REFERENCES prompts (id)
            )`,
            `CREATE TABLE IF NOT EXISTS prompt_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER,
                execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (prompt_id) REFERENCES prompts (id)
            )`,
            `CREATE TABLE IF NOT EXISTS favorite_prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER,
                added_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (prompt_id) REFERENCES prompts (id),
                UNIQUE(prompt_id)
            )`
        ];

        for (const table of tables) {
            const result = await runAsync(table);

            if (!result.success) {
                return { success: false, error: result.error };
            }
        }
        return { success: true };
    } catch (error) {
        handleError(error, 'initializing database');
        return { success: false, error: 'Failed to initialize database' };
    }
}

export async function fetchCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
    return getCachedOrFetch('all_prompts_categories', async () => {
        const result = await allAsync<any>(`
            SELECT p.id, p.title, p.primary_category, p.description, p.directory as path, p.tags,
                   GROUP_CONCAT(DISTINCT s.name) as subcategories
            FROM prompts p
            LEFT JOIN subcategories s ON p.id = s.prompt_id
            GROUP BY p.id
        `);

        if (!result.success) {
            return { success: false, error: 'Failed to fetch prompts with categories' };
        }

        const categorizedPrompts: Record<string, CategoryItem[]> = {};
        result.data?.forEach((prompt) => {
            const category = prompt.primary_category;

            if (!categorizedPrompts[category]) {
                categorizedPrompts[category] = [];
            }

            categorizedPrompts[category].push({
                ...prompt,
                tags: prompt.tags ? prompt.tags.split(',') : [],
                subcategories: prompt.subcategories ? prompt.subcategories.split(',') : []
            });
        });
        return { success: true, data: categorizedPrompts };
    });
}

export async function getPromptDetails(
    promptId: string
): Promise<ApiResult<PromptMetadata & { variables: PromptVariable[] }>> {
    const promptResult = await getAsync<PromptMetadata>('SELECT * FROM prompts WHERE id = ?', [promptId]);
    const variablesResult = await allAsync<PromptVariable>(
        'SELECT name, role, value, optional_for_user FROM variables WHERE prompt_id = ?',
        [promptId]
    );

    if (!promptResult.success || !variablesResult.success) {
        return { success: false, error: 'Failed to fetch prompt details' };
    }

    if (promptResult.data) {
        promptResult.data.tags = promptResult.data.tags || [];
    }
    return {
        success: true,
        data: {
            ...promptResult.data!,
            variables: variablesResult.data || []
        }
    };
}

export async function updatePromptVariable(
    promptId: string,
    variableName: string,
    value: string
): Promise<ApiResult<void>> {
    try {
        const result = await runAsync('UPDATE variables SET value = ? WHERE prompt_id = ? AND name = ?', [
            value,
            promptId,
            variableName
        ]);

        if (!result.success) {
            return { success: false, error: result.error || 'Unknown database error' };
        }

        if (result.data?.changes === 0) {
            return { success: false, error: `No variable found with name ${variableName} for prompt ${promptId}` };
        }

        cache.flushAll();
        return { success: true };
    } catch (error) {
        handleError(error, 'updating prompt variable');
        return { success: false, error: 'Failed to update prompt variable' };
    }
}

export async function getRecentExecutions(limit: number = 5): Promise<any[]> {
    const query = `
        SELECT pe.id, pe.prompt_id, pe.execution_time, p.title, p.primary_category 
        FROM prompt_executions pe
        JOIN prompts p ON pe.prompt_id = p.id
        ORDER BY pe.execution_time DESC
        LIMIT ?
    `;

    try {
        const result = await allAsync(query, [limit]);

        if (result.success && result.data && result.data.length > 0) {
            return result.data;
        }
        return [];
    } catch (error) {
        handleError(error, 'fetching recent executions');
        return [];
    }
}

export async function recordPromptExecution(promptId: number | string): Promise<ApiResult<void>> {
    try {
        const result = await runAsync('INSERT INTO prompt_executions (prompt_id) VALUES (?)', [promptId]);
        return { success: result.success };
    } catch (error) {
        handleError(error, 'recording prompt execution');
        return { success: false, error: 'Failed to record prompt execution' };
    }
}

export async function addPromptToFavorites(promptId: number | string): Promise<ApiResult<void>> {
    try {
        const result = await runAsync('INSERT OR IGNORE INTO favorite_prompts (prompt_id) VALUES (?)', [promptId]);
        return { success: result.success };
    } catch (error) {
        handleError(error, 'adding prompt to favorites');
        return { success: false, error: 'Failed to add prompt to favorites' };
    }
}

export async function removePromptFromFavorites(promptId: number | string): Promise<ApiResult<void>> {
    try {
        const result = await runAsync('DELETE FROM favorite_prompts WHERE prompt_id = ?', [promptId]);
        return { success: result.success };
    } catch (error) {
        handleError(error, 'removing prompt from favorites');
        return { success: false, error: 'Failed to remove prompt from favorites' };
    }
}

export async function getFavoritePrompts(): Promise<ApiResult<any[]>> {
    const query = `
        SELECT fp.id, fp.prompt_id, fp.added_time, p.title, p.primary_category, p.description
        FROM favorite_prompts fp
        JOIN prompts p ON fp.prompt_id = p.id
        ORDER BY fp.added_time DESC
    `;

    try {
        return await allAsync(query);
    } catch (error) {
        handleError(error, 'fetching favorite prompts');
        return { success: false, error: 'Failed to fetch favorite prompts' };
    }
}

export async function syncPromptsWithDatabase(): Promise<ApiResult<void>> {
    try {
        const promptDirs = await readDirectory(cliConfig.PROMPTS_DIR);
        logger.info(`Found ${promptDirs.length} items in prompts directory:`, promptDirs);

        await runAsync('DELETE FROM prompts', []);
        await runAsync('DELETE FROM subcategories', []);
        await runAsync('DELETE FROM variables', []);
        await runAsync('DELETE FROM fragments', []);

        for (const dir of promptDirs) {
            const promptPath = path.join(cliConfig.PROMPTS_DIR, dir, commonConfig.PROMPT_FILE_NAME);
            const metadataPath = path.join(cliConfig.PROMPTS_DIR, dir, commonConfig.METADATA_FILE_NAME);
            logger.info(`Checking prompt: ${dir}`);
            logger.info(`Prompt file exists: ${await fileExists(promptPath)}`);
            logger.info(`Metadata file exists: ${await fileExists(metadataPath)}`);

            if ((await fileExists(promptPath)) && (await fileExists(metadataPath))) {
                const promptContent = await readFileContent(promptPath);
                const metadataContent = await readFileContent(metadataPath);

                try {
                    const metadata = yaml.load(metadataContent) as PromptMetadata;
                    await createPrompt(metadata, promptContent);
                    logger.info(`Successfully processed prompt: ${dir}`);
                } catch (error) {
                    handleError(error, `processing prompt ${dir}`);
                }
            } else {
                logger.warn(`Skipping ${dir}: missing prompt or metadata file`);
            }
        }

        cache.flushAll();

        logger.info('Database sync completed');
        return { success: true };
    } catch (error) {
        handleError(error, 'syncing prompts with database');
        return { success: false, error: 'Failed to sync prompts with database' };
    }
}

export async function cleanupOrphanedData(): Promise<ApiResult<void>> {
    try {
        const promptDirs = await readDirectory(cliConfig.PROMPTS_DIR);
        const existingPromptIds = promptDirs.map((dir) => parseInt(dir, 10)).filter((id) => !isNaN(id));

        if (existingPromptIds.length === 0) {
            logger.warn('No valid prompt IDs found. Skipping orphaned data cleanup.');
            return { success: true };
        }

        await runAsync('DELETE FROM prompts WHERE id NOT IN (?)', [existingPromptIds.join(',')]);
        await runAsync('DELETE FROM subcategories WHERE prompt_id NOT IN (SELECT id FROM prompts)');

        const orphanedVariables = await allAsync<{ id: number; name: string; prompt_id: number }>(
            'SELECT id, name, prompt_id FROM variables WHERE prompt_id NOT IN (SELECT id FROM prompts)'
        );

        if (orphanedVariables.success && orphanedVariables.data) {
            for (const variable of orphanedVariables.data) {
                const usedVariable = await getAsync<{ count: number }>(
                    'SELECT COUNT(*) as count FROM variables WHERE name = ? AND prompt_id IN (SELECT id FROM prompts)',
                    [variable.name]
                );

                if (usedVariable.success && usedVariable.data && usedVariable.data.count === 0) {
                    await runAsync('DELETE FROM variables WHERE id = ?', [variable.id]);
                    logger.info(`Deleted orphaned variable: ${variable.name}`);
                } else {
                    logger.info(`Kept shared variable: ${variable.name}`);
                }
            }
        }

        await runAsync('DELETE FROM fragments WHERE prompt_id NOT IN (SELECT id FROM prompts)');

        const orphanedEnvVars = await allAsync<{ id: number; name: string; prompt_id: number | null }>(
            'SELECT id, name, prompt_id FROM env_vars WHERE prompt_id IS NOT NULL AND prompt_id NOT IN (SELECT id FROM prompts)'
        );

        if (orphanedEnvVars.success && orphanedEnvVars.data) {
            for (const envVar of orphanedEnvVars.data) {
                const usedEnvVar = await getAsync<{ count: number }>(
                    'SELECT COUNT(*) as count FROM env_vars WHERE name = ? AND (prompt_id IS NULL OR prompt_id IN (SELECT id FROM prompts))',
                    [envVar.name]
                );

                if (usedEnvVar.success && usedEnvVar.data && usedEnvVar.data.count === 0) {
                    await runAsync('DELETE FROM env_vars WHERE id = ?', [envVar.id]);
                    logger.info(`Deleted orphaned env var: ${envVar.name}`);
                } else {
                    logger.info(`Kept shared env var: ${envVar.name}`);
                }
            }
        }

        cache.flushAll();

        logger.info('Orphaned data cleaned up successfully');
        return { success: true };
    } catch (error) {
        handleError(error, 'cleaning up orphaned data');
        return { success: false, error: 'Failed to clean up orphaned data' };
    }
}

export async function flushData(): Promise<void> {
    logger.info('Starting data flush process');

    try {
        await runAsync('DELETE FROM prompts');
        await runAsync('DELETE FROM subcategories');
        await runAsync('DELETE FROM variables');
        await runAsync('DELETE FROM fragments');
        await runAsync('DELETE FROM env_vars');
        logger.info('Database tables cleared');

        await fs.emptyDir(cliConfig.PROMPTS_DIR);
        logger.info('Prompts directory cleared');

        await fs.emptyDir(cliConfig.FRAGMENTS_DIR);
        logger.info('Fragments directory cleared');

        await fs.emptyDir(cliConfig.TEMP_DIR);
        logger.info('Temporary directory cleared');

        logger.info('Data flush completed successfully');
    } catch (error) {
        handleError(error, 'flushing data');
        throw new Error('Failed to flush data');
    }
}

export { db };
