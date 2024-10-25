import { EnvVariable } from '../../../shared/types';
import { runAsync, allAsync } from '../database';
import { createEnvVariable, readEnvVariables, updateEnvVariable, deleteEnvVariable } from '../env-vars';

jest.mock('../database', () => ({
    runAsync: jest.fn(),
    allAsync: jest.fn()
}));

describe('EnvVarsUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('createEnvVariable', () => {
        it('should successfully create an environment variable', async () => {
            const mockEnvVar: Omit<EnvVariable, 'id'> = {
                name: 'TEST_VAR',
                value: 'test-value',
                scope: 'global',
                prompt_id: undefined
            };
            (runAsync as jest.Mock).mockResolvedValue({
                success: true,
                data: { lastID: 1 }
            });

            const result = await createEnvVariable(mockEnvVar);
            expect(result).toEqual({
                success: true,
                data: { ...mockEnvVar, id: 1 }
            });
            expect(runAsync).toHaveBeenCalledWith(
                'INSERT INTO env_vars (name, value, scope, prompt_id) VALUES (?, ?, ?, ?)',
                ['TEST_VAR', 'test-value', 'global', null]
            );
        });

        it('should handle database errors during creation', async () => {
            const mockEnvVar: Omit<EnvVariable, 'id'> = {
                name: 'TEST_VAR',
                value: 'test-value',
                scope: 'global',
                prompt_id: undefined
            };
            (runAsync as jest.Mock).mockRejectedValue(new Error('Database error'));

            const result = await createEnvVariable(mockEnvVar);
            expect(result).toEqual({
                success: false,
                error: 'Failed to create environment variable'
            });
        });
    });

    describe('readEnvVariables', () => {
        it('should read all global environment variables', async () => {
            const mockEnvVars = [
                { id: 1, name: 'TEST_VAR1', value: 'value1', scope: 'global', prompt_id: null },
                { id: 2, name: 'TEST_VAR2', value: 'value2', scope: 'global', prompt_id: null }
            ];
            (allAsync as jest.Mock).mockResolvedValue({
                success: true,
                data: mockEnvVars
            });

            const result = await readEnvVariables();
            expect(result).toEqual({
                success: true,
                data: mockEnvVars
            });
            expect(allAsync).toHaveBeenCalledWith('SELECT * FROM env_vars WHERE scope = "global"', []);
        });

        it('should read environment variables for specific prompt', async () => {
            const promptId = 123;
            const mockEnvVars = [{ id: 1, name: 'TEST_VAR1', value: 'value1', scope: 'prompt', prompt_id: promptId }];
            (allAsync as jest.Mock).mockResolvedValue({
                success: true,
                data: mockEnvVars
            });

            const result = await readEnvVariables(promptId);
            expect(result).toEqual({
                success: true,
                data: mockEnvVars
            });
            expect(allAsync).toHaveBeenCalledWith(
                'SELECT * FROM env_vars WHERE scope = "global" OR (scope = "prompt" AND prompt_id = ?)',
                [promptId]
            );
        });

        it('should handle database errors during read', async () => {
            (allAsync as jest.Mock).mockRejectedValue(new Error('Database error'));

            const result = await readEnvVariables();
            expect(result).toEqual({
                success: false,
                error: 'Failed to read environment variables'
            });
        });

        it('should handle unsuccessful database response', async () => {
            (allAsync as jest.Mock).mockResolvedValue({
                success: false,
                data: undefined,
                error: undefined
            });

            const result = await readEnvVariables();
            expect(result).toEqual({
                success: false,
                error: 'Failed to fetch environment variables'
            });
        });
    });

    describe('updateEnvVariable', () => {
        it('should successfully update an environment variable', async () => {
            (runAsync as jest.Mock).mockResolvedValue({
                success: true,
                data: { changes: 1 }
            });

            const result = await updateEnvVariable(1, 'new-value');
            expect(result).toEqual({ success: true });
            expect(runAsync).toHaveBeenCalledWith('UPDATE env_vars SET value = ? WHERE id = ?', ['new-value', 1]);
        });

        it('should handle non-existent environment variable', async () => {
            (runAsync as jest.Mock).mockResolvedValue({
                success: true,
                data: { changes: 0 }
            });

            const result = await updateEnvVariable(999, 'new-value');
            expect(result).toEqual({
                success: false,
                error: 'No environment variable found with id 999'
            });
        });

        it('should handle database errors during update', async () => {
            (runAsync as jest.Mock).mockRejectedValue(new Error('Database error'));

            const result = await updateEnvVariable(1, 'new-value');
            expect(result).toEqual({
                success: false,
                error: 'Failed to update environment variable'
            });
        });
    });

    describe('deleteEnvVariable', () => {
        it('should successfully delete an environment variable', async () => {
            (runAsync as jest.Mock).mockResolvedValue({
                success: true
            });

            const result = await deleteEnvVariable(1);
            expect(result).toEqual({ success: true });
            expect(runAsync).toHaveBeenCalledWith('DELETE FROM env_vars WHERE id = ?', [1]);
        });

        it('should handle database errors during deletion', async () => {
            (runAsync as jest.Mock).mockRejectedValue(new Error('Database error'));

            const result = await deleteEnvVariable(1);
            expect(result).toEqual({
                success: false,
                error: 'Failed to delete environment variable'
            });
        });
    });
});
