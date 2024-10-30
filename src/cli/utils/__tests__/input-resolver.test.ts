import { jest } from '@jest/globals';

import { EnvVariable } from '../../../shared/types';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../../constants';
import { readEnvVars } from '../env-vars';
import { viewFragmentContent } from '../fragments';
import { resolveValue, resolveInputs } from '../input-resolver';

jest.mock('../env-vars');
jest.mock('../fragments');
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

describe('InputResolverUtils', () => {
    const mockReadEnvVars = readEnvVars as jest.MockedFunction<typeof readEnvVars>;
    const mockViewFragmentContent = viewFragmentContent as jest.MockedFunction<typeof viewFragmentContent>;
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('resolveValue', () => {
        const mockEnvVars: EnvVariable[] = [
            { id: 1, name: 'TEST_VAR', value: 'test-value', scope: 'global' },
            { id: 2, name: 'NESTED_VAR', value: '$env:TEST_VAR', scope: 'global' }
        ];
        it('should resolve fragment references', async () => {
            const fragmentContent = '# Test Fragment Content';
            mockViewFragmentContent.mockResolvedValueOnce({
                success: true,
                data: fragmentContent
            });

            const result = await resolveValue(`${FRAGMENT_PREFIX}category/fragment`, mockEnvVars);
            expect(result).toBe(fragmentContent);
            expect(mockViewFragmentContent).toHaveBeenCalledWith('category', 'fragment');
        });

        it('should handle failed fragment resolution', async () => {
            mockViewFragmentContent.mockResolvedValueOnce({
                success: false,
                error: 'Fragment not found'
            });

            const value = `${FRAGMENT_PREFIX}category/nonexistent`;
            const result = await resolveValue(value, mockEnvVars);
            expect(result).toBe(value);
        });

        it('should resolve environment variables', async () => {
            const result = await resolveValue(`${ENV_PREFIX}TEST_VAR`, mockEnvVars);
            expect(result).toBe('test-value');
        });

        it('should handle nested environment variables', async () => {
            const result = await resolveValue(`${ENV_PREFIX}NESTED_VAR`, mockEnvVars);
            expect(result).toBe('test-value');
        });

        it('should handle non-existent environment variables', async () => {
            const value = `${ENV_PREFIX}NONEXISTENT`;
            const result = await resolveValue(value, mockEnvVars);
            expect(result).toBe(value);
        });

        it('should return plain values unchanged', async () => {
            const value = 'plain-value';
            const result = await resolveValue(value, mockEnvVars);
            expect(result).toBe(value);
        });
    });

    describe('resolveInputs', () => {
        it('should resolve multiple inputs', async () => {
            const inputs = {
                fragment: `${FRAGMENT_PREFIX}category/fragment`,
                env: `${ENV_PREFIX}TEST_VAR`,
                plain: 'plain-value'
            };
            mockReadEnvVars.mockResolvedValueOnce({
                success: true,
                data: [{ id: 1, name: 'TEST_VAR', value: 'test-value', scope: 'global' }]
            });

            mockViewFragmentContent.mockResolvedValueOnce({
                success: true,
                data: 'fragment-content'
            });

            const result = await resolveInputs(inputs);
            expect(result).toEqual({
                fragment: 'fragment-content',
                env: 'test-value',
                plain: 'plain-value'
            });
        });

        it('should handle env vars fetch failure', async () => {
            mockReadEnvVars.mockResolvedValueOnce({
                success: false,
                error: 'Failed to fetch env vars'
            });

            const inputs = {
                plain: 'value'
            };
            const result = await resolveInputs(inputs);
            expect(result).toEqual({
                plain: 'value'
            });
        });

        it('should handle resolution errors', async () => {
            mockReadEnvVars.mockRejectedValueOnce(new Error('Failed to fetch env vars'));

            const inputs = {
                test: 'value'
            };
            await expect(resolveInputs(inputs)).rejects.toThrow();
        });
    });
});
