import { runAsync, allAsync } from './database.util';
import { handleError } from './error.util';
import { EnvVar, ApiResult } from '../../shared/types';

export async function createEnvVar(envVar: Omit<EnvVar, 'id'>): Promise<ApiResult<EnvVar>> {
    try {
        const result = await runAsync('INSERT INTO env_vars (name, value, scope, prompt_id) VALUES (?, ?, ?, ?)', [
            envVar.name,
            envVar.value,
            envVar.scope,
            envVar.prompt_id || null
        ]);
        return {
            success: true,
            data: { ...envVar, id: result.data?.lastID ?? -1 }
        };
    } catch (error) {
        handleError(error, 'creating environment variable');
        return { success: false, error: 'Failed to create environment variable' };
    }
}

export async function readEnvVars(promptId?: number): Promise<ApiResult<EnvVar[]>> {
    try {
        let query = 'SELECT * FROM env_vars WHERE scope = "global"';
        const params: any[] = [];

        if (promptId) {
            query += ' OR (scope = "prompt" AND prompt_id = ?)';
            params.push(promptId);
        }

        const result = await allAsync<EnvVar>(query, params);

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to fetch environment variables' };
        }
        return { success: true, data: result.data || [] };
    } catch (error) {
        handleError(error, 'reading environment variables');
        return { success: false, error: 'Failed to read environment variables' };
    }
}

export async function updateEnvVar(id: number, newValue: string): Promise<ApiResult<void>> {
    try {
        const result = await runAsync('UPDATE env_vars SET value = ? WHERE id = ?', [newValue, id]);

        if (result.success && result.data && result.data.changes === 0) {
            return { success: false, error: `No environment variable found with id ${id}` };
        }
        return { success: true };
    } catch (error) {
        handleError(error, 'updating environment variable');
        return { success: false, error: 'Failed to update environment variable' };
    }
}

export async function deleteEnvVar(id: number): Promise<ApiResult<void>> {
    try {
        await runAsync('DELETE FROM env_vars WHERE id = ?', [id]);
        return { success: true };
    } catch (error) {
        handleError(error, 'deleting environment variable');
        return { success: false, error: 'Failed to delete environment variable' };
    }
}
