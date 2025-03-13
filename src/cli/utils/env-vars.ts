import { runAsync, allAsync } from './database';
import { handleError } from './errors';
import { EnvVariable, ApiResult } from '../../shared/types';

export async function createEnvVar(envVar: Omit<EnvVariable, 'id'>): Promise<ApiResult<EnvVariable>> {
    try {
        // Normalize the variable name to uppercase snake case
        const normalizedName = envVar.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        
        // Check if a variable with this name already exists
        const existingResult = await allAsync<EnvVariable>(
            'SELECT * FROM env_vars WHERE name = ?', 
            [normalizedName]
        );
        
        if (existingResult.success && existingResult.data && existingResult.data.length > 0) {
            // Update existing variable instead of creating a new one
            const existing = existingResult.data[0];
            const updateResult = await runAsync(
                'UPDATE env_vars SET value = ?, scope = ?, prompt_id = ? WHERE id = ?',
                [envVar.value, envVar.scope, envVar.prompt_id || null, existing.id]
            );
            
            if (!updateResult.success) {
                throw new Error(`Failed to update existing variable: ${updateResult.error}`);
            }
            
            return {
                success: true,
                data: { ...envVar, name: normalizedName, id: existing.id }
            };
        }
        
        // Create a new variable
        const result = await runAsync(
            'INSERT INTO env_vars (name, value, scope, prompt_id) VALUES (?, ?, ?, ?)', 
            [normalizedName, envVar.value, envVar.scope, envVar.prompt_id || null]
        );
        
        if (!result.success) {
            throw new Error(`Database insert failed: ${result.error}`);
        }
        
        // Verify the variable was created by fetching it
        const verifyResult = await allAsync<EnvVariable>(
            'SELECT * FROM env_vars WHERE name = ?', 
            [normalizedName]
        );
        
        if (!verifyResult.success || !verifyResult.data || verifyResult.data.length === 0) {
            throw new Error('Variable was not found after creation');
        }
        
        return {
            success: true,
            data: verifyResult.data[0]
        };
    } catch (error) {
        handleError(error, 'creating environment variable');
        
        // Provide more specific error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { 
            success: false, 
            error: `Failed to create environment variable: ${errorMessage}` 
        };
    }
}

export async function readEnvVars(promptId?: number): Promise<ApiResult<EnvVariable[]>> {
    try {
        // First attempt: standard query to fetch all environment variables
        let query = 'SELECT * FROM env_vars WHERE scope = "global"';
        const params: any[] = [];

        if (promptId) {
            query += ' OR (scope = "prompt" AND prompt_id = ?)';
            params.push(promptId);
        }

        const result = await allAsync<EnvVariable>(query, params);

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to fetch environment variables' };
        }
        
        // Log the number of variables found for debugging
        console.debug(`Found ${result.data?.length || 0} environment variables`);
        
        return { success: true, data: result.data || [] };
    } catch (error) {
        handleError(error, 'reading environment variables');
        return { success: false, error: 'Failed to read environment variables' };
    }
}

// New utility function to get a single environment variable by name
export async function getEnvVarByName(name: string): Promise<ApiResult<EnvVariable | null>> {
    try {
        // Normalize the name for consistent comparison
        const normalizedName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        
        // Use a case-insensitive query to find the variable
        const query = 'SELECT * FROM env_vars WHERE UPPER(name) = ?';
        const result = await allAsync<EnvVariable>(query, [normalizedName]);
        
        if (!result.success) {
            return { success: false, error: result.error || 'Failed to fetch environment variable' };
        }
        
        if (!result.data || result.data.length === 0) {
            // Variable wasn't found
            return { success: true, data: null };
        }
        
        return { success: true, data: result.data[0] };
    } catch (error) {
        handleError(error, 'getting environment variable by name');
        return { success: false, error: 'Failed to get environment variable' };
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
