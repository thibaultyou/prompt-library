import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { DatabaseRepository } from './database.repository';
import { IVariableRepository } from '../../../core/variable/repositories/variable.repository.interface';
import { CACHE_KEYS, SQL_QUERIES, CACHE_TTL, DB_TABLES } from '../../../shared/constants';
import { ApiResult, Result, EnvVariable } from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqliteVariableRepository implements IVariableRepository {
    private readonly CACHE_KEYS = {
        ALL_ENV_VARS: `${CACHE_KEYS.VARIABLE}_all`,
        GLOBAL_ENV_VARS: `${CACHE_KEYS.VARIABLE}_global`,
        GLOBAL_AND_PROMPT_VARS: (promptId: number | string): string =>
            `${CACHE_KEYS.VARIABLE}_global_prompt_${promptId}`,
        PROMPT_ENV_VARS: (promptId: number | string): string => `${CACHE_KEYS.VARIABLE}_prompt_${promptId}`,
        ENV_VAR_BY_NAME: (name: string): string => `${CACHE_KEYS.VARIABLE}_name_${name}`,
        ALL_UNIQUE_VARS: `${CACHE_KEYS.VARIABLE}_unique_all`,
        PROMPTS_USING_VAR: (name: string): string => `${CACHE_KEYS.VARIABLE}_prompts_using_${name}`
    };

    constructor(
        private readonly dbRepo: DatabaseRepository,
        private readonly dbService: DatabaseService,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService))
        private readonly errorService: ErrorService
    ) {}

    async getAllUniqueVariables(): Promise<ApiResult<Array<{ name: string; role: string; promptIds: string[] }>>> {
        const cacheKey = this.CACHE_KEYS.ALL_UNIQUE_VARS;
        this.loggerService.debug(`Getting all unique variables, cache key: ${cacheKey}`);

        try {
            const cachedData =
                this.dbRepo.getCache<Array<{ name: string; role: string; promptIds: string[] }>>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit for unique variables key: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss for unique variables key: ${cacheKey}. Fetching...`);
            const promptVarsResult = await this.dbService.getAllRows<{ name: string; role: string; prompt_id: number }>(
                SQL_QUERIES.VARIABLE.GET_ALL
            );

            if (!promptVarsResult.success)
                return Result.failure(promptVarsResult.error || 'Failed to fetch prompt variables.');

            const variableMap = this.groupVariablesByName(promptVarsResult.data || []);
            await this.mergeWithEnvironmentVariables(variableMap);
            const uniqueVariables = Array.from(variableMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            this.dbRepo.setCache(cacheKey, uniqueVariables, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored ${uniqueVariables.length} unique variables in cache.`);
            return Result.success(uniqueVariables);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get unique variables: ${message}`),
                'SqliteVariableRepository.getAllUniqueVariables'
            );
            return Result.failure(`Failed to get unique variables: ${message}`);
        }
    }

    private groupVariablesByName(
        variables: Array<{ name: string; role: string; prompt_id: number }>
    ): Map<string, { name: string; role: string; promptIds: string[] }> {
        const variableMap = new Map<string, { name: string; role: string; promptIds: string[] }>();

        for (const row of variables) {
            const originalName = row.name.replace(/[{}]/g, '');
            const normalizedKey = this.stringFormatterService.normalizeVariableName(originalName, false);

            if (!variableMap.has(normalizedKey)) {
                variableMap.set(normalizedKey, {
                    name: originalName,
                    role: row.role || 'Variable from prompt',
                    promptIds: row.prompt_id ? [String(row.prompt_id)] : []
                });
            } else {
                const existing = variableMap.get(normalizedKey)!;

                if (row.prompt_id && !existing.promptIds.includes(String(row.prompt_id))) {
                    existing.promptIds.push(String(row.prompt_id));
                }
            }
        }
        return variableMap;
    }

    private async mergeWithEnvironmentVariables(
        variableMap: Map<string, { name: string; role: string; promptIds: string[] }>
    ): Promise<void> {
        const envVarsResult = await this.getAllEnvVars();

        if (envVarsResult.success && envVarsResult.data) {
            for (const envVar of envVarsResult.data) {
                const normalizedKey = this.stringFormatterService.normalizeVariableName(envVar.name, false);

                if (!variableMap.has(normalizedKey)) {
                    variableMap.set(normalizedKey, {
                        name: envVar.name,
                        role: envVar.description || 'Custom Environment Variable',
                        promptIds: []
                    });
                }
            }
        } else {
            this.loggerService.warn(`Could not merge env vars: ${envVarsResult.error}`);
        }
    }

    async getPromptsUsingVariable(name: string): Promise<ApiResult<string[]>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        const cacheKey = this.CACHE_KEYS.PROMPTS_USING_VAR(normalizedName);
        this.loggerService.debug(`Getting prompts using variable "${normalizedName}", cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<string[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const variableNameInDB = `{{${normalizedName}}}`;
            const result = await this.dbService.getAllRows<{ prompt_id: number }>(
                SQL_QUERIES.VARIABLE.GET_PROMPTS_BY_VARIABLE,
                [variableNameInDB]
            );

            if (!result.success) return Result.failure(result.error || 'Failed to fetch prompts.');

            const promptIds = (result.data || []).map((row) => String(row.prompt_id));
            this.dbRepo.setCache(cacheKey, promptIds, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored ${promptIds.length} prompt IDs using "${normalizedName}" in cache.`);
            return Result.success(promptIds);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get prompts using "${name}": ${message}`),
                'SqliteVariableRepository.getPromptsUsingVariable'
            );
            return Result.failure(`Failed to get prompts using variable: ${message}`);
        }
    }

    async getAllEnvVars(): Promise<ApiResult<EnvVariable[]>> {
        const cacheKey = this.CACHE_KEYS.ALL_ENV_VARS;
        this.loggerService.debug(`Getting all env vars, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<EnvVariable[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_ALL);

            if (!result.success) return Result.failure(result.error || 'Failed to fetch env vars.');

            const envVars = result.data || [];
            this.dbRepo.setCache(cacheKey, envVars, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored ${envVars.length} env vars in cache.`);
            return Result.success(envVars);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get all env vars: ${message}`),
                'SqliteVariableRepository.getAllEnvVars'
            );
            return Result.failure(`Failed to read env vars: ${message}`);
        }
    }

    async addEnvVar(
        name: string,
        value: string,
        scope: 'global' | 'prompt' = 'global',
        promptId?: number
    ): Promise<ApiResult<EnvVariable>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`Adding env var: "${normalizedName}", Scope: ${scope}, PromptID: ${promptId}`);
        return await this.dbService.executeTransaction(async () => {
            try {
                const existingVariable = await this.findExistingEnvVar(normalizedName);

                if (existingVariable) {
                    this.loggerService.debug(
                        `Env var "${normalizedName}" exists (ID: ${existingVariable.id}). Updating.`
                    );
                    return await this.updateExistingEnvVar(existingVariable, value, scope, promptId);
                }

                this.loggerService.debug(`Env var "${normalizedName}" does not exist. Creating new.`);
                return await this.createNewEnvVar(normalizedName, value, scope, promptId);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new AppError('VARIABLE_ERROR', `Failed to add env var "${normalizedName}": ${message}`);
            }
        });
    }

    private async findExistingEnvVar(normalizedName: string): Promise<EnvVariable | null> {
        const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_BY_NAME_INSENSITIVE, [
            normalizedName
        ]);
        return result.success && result.data && result.data.length > 0 ? result.data[0] : null;
    }

    private async updateExistingEnvVar(
        existing: EnvVariable,
        value: string,
        scope: 'global' | 'prompt',
        promptId?: number
    ): Promise<ApiResult<EnvVariable>> {
        const updateResult = await this.dbService.runQuery(SQL_QUERIES.ENV_VAR.UPDATE_FULL, [
            value,
            scope,
            promptId || null,
            existing.id
        ]);

        if (!updateResult.success) {
            throw new AppError('DB_ERROR', `Failed update existing env var ID ${existing.id}: ${updateResult.error}`);
        }

        this.invalidateEnvVarCache(existing.name);
        const updatedData = { ...existing, value, scope, prompt_id: promptId };
        return Result.success(updatedData);
    }

    private async createNewEnvVar(
        normalizedName: string,
        value: string,
        scope: 'global' | 'prompt',
        promptId?: number
    ): Promise<ApiResult<EnvVariable>> {
        const result = await this.dbService.runQuery(SQL_QUERIES.ENV_VAR.INSERT, [
            normalizedName,
            value,
            scope,
            promptId || null
        ]);

        if (!result.success || !result.data?.lastID) {
            throw new AppError('DB_ERROR', `DB insert failed for env var "${normalizedName}": ${result.error}`);
        }

        const newId = result.data.lastID;
        this.invalidateEnvVarCache();
        return Result.success({ id: newId, name: normalizedName, value, scope, prompt_id: promptId });
    }

    async updateEnvVar(id: number, value: string): Promise<ApiResult<void>> {
        this.loggerService.debug(`Updating env var ID: ${id}`);

        try {
            const currentVar = await this.dbService.getSingleRow<EnvVariable>(
                `SELECT name FROM ${DB_TABLES.ENV_VARS} WHERE id = ?`,
                [id]
            );
            const result = await this.dbService.runQuery(SQL_QUERIES.ENV_VAR.UPDATE, [value, id]);

            if (!result.success) return Result.failure(result.error || `Failed update env var ID ${id}.`);

            if (result.data?.changes === 0) return Result.failure(`No env var found with ID ${id}.`);

            if (currentVar.success && currentVar.data) this.invalidateEnvVarCache(currentVar.data.name);
            else this.invalidateEnvVarCache();
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed update env var ID ${id}: ${message}`),
                'SqliteVariableRepository.updateEnvVar'
            );
            return Result.failure(`Failed to update env var: ${message}`);
        }
    }

    async deleteEnvVar(id: number): Promise<ApiResult<void>> {
        this.loggerService.debug(`Deleting env var ID: ${id}`);

        try {
            const currentVar = await this.dbService.getSingleRow<EnvVariable>(
                `SELECT name FROM ${DB_TABLES.ENV_VARS} WHERE id = ?`,
                [id]
            );
            const result = await this.dbService.runQuery(SQL_QUERIES.ENV_VAR.DELETE, [id]);

            if (!result.success) return Result.failure(result.error || `Failed delete env var ID ${id}.`);

            if (result.data?.changes === 0) {
                this.loggerService.warn(`No env var found with ID ${id} to delete.`);
                return Result.success(undefined);
            }

            if (currentVar.success && currentVar.data) this.invalidateEnvVarCache(currentVar.data.name);
            else this.invalidateEnvVarCache();
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed delete env var ID ${id}: ${message}`),
                'SqliteVariableRepository.deleteEnvVar'
            );
            return Result.failure(`Failed to delete env var: ${message}`);
        }
    }

    async getGlobalEnvVars(): Promise<ApiResult<EnvVariable[]>> {
        const cacheKey = this.CACHE_KEYS.GLOBAL_ENV_VARS;
        this.loggerService.debug(`Getting global env vars, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<EnvVariable[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_GLOBAL);

            if (!result.success) return Result.failure(result.error || 'Failed to fetch global env vars.');

            const envVars = result.data || [];
            this.dbRepo.setCache(cacheKey, envVars, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored ${envVars.length} global env vars in cache.`);
            return Result.success(envVars);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get global env vars: ${message}`),
                'SqliteVariableRepository.getGlobalEnvVars'
            );
            return Result.failure(`Failed to get global env vars: ${message}`);
        }
    }

    async getPromptEnvVars(promptId: number | string): Promise<ApiResult<EnvVariable[]>> {
        const id = typeof promptId === 'string' ? parseInt(promptId, 10) : promptId;

        if (isNaN(id)) return Result.failure('Invalid prompt ID.');

        const cacheKey = this.CACHE_KEYS.PROMPT_ENV_VARS(id);
        this.loggerService.debug(`Getting prompt env vars for ID ${id}, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<EnvVariable[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_PROMPT_SPECIFIC, [id]);

            if (!result.success) return Result.failure(result.error || 'Failed to fetch prompt env vars.');

            const envVars = result.data || [];
            this.dbRepo.setCache(cacheKey, envVars, CACHE_TTL.DEFAULT);
            this.loggerService.debug(`Stored ${envVars.length} prompt env vars in cache for ID ${id}.`);
            return Result.success(envVars);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get prompt env vars for ${id}: ${message}`),
                'SqliteVariableRepository.getPromptEnvVars'
            );
            return Result.failure(`Failed to get prompt env vars: ${message}`);
        }
    }

    async getGlobalAndPromptEnvVars(promptId: number | string): Promise<ApiResult<EnvVariable[]>> {
        const id = typeof promptId === 'string' ? parseInt(promptId, 10) : promptId;

        if (isNaN(id)) return Result.failure('Invalid prompt ID.');

        const cacheKey = this.CACHE_KEYS.GLOBAL_AND_PROMPT_VARS(id);
        this.loggerService.debug(`Getting global & prompt env vars for ID ${id}, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<EnvVariable[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_GLOBAL_AND_PROMPT, [
                id
            ]);

            if (!result.success) return Result.failure(result.error || 'Failed to fetch combined env vars.');

            const envVars = result.data || [];
            this.dbRepo.setCache(cacheKey, envVars, CACHE_TTL.DEFAULT);
            this.loggerService.debug(`Stored ${envVars.length} combined env vars in cache for ID ${id}.`);
            return Result.success(envVars);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get global/prompt env vars for ${id}: ${message}`),
                'SqliteVariableRepository.getGlobalAndPromptEnvVars'
            );
            return Result.failure(`Failed to get combined env vars: ${message}`);
        }
    }

    async getEnvVarByName(name: string): Promise<ApiResult<EnvVariable | null>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        const cacheKey = this.CACHE_KEYS.ENV_VAR_BY_NAME(normalizedName);
        this.loggerService.debug(`Getting env var by name "${normalizedName}", cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<EnvVariable | null>(cacheKey);

            if (cachedData !== undefined) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<EnvVariable>(SQL_QUERIES.ENV_VAR.GET_BY_NAME_INSENSITIVE, [
                normalizedName
            ]);

            if (!result.success) return Result.failure(result.error || 'Failed to fetch env var by name.');

            const variable = result.data && result.data.length > 0 ? result.data[0] : null;
            this.dbRepo.setCache(cacheKey, variable, CACHE_TTL.DEFAULT);
            this.loggerService.debug(`Stored env var by name result in cache. Found: ${!!variable}`);
            return Result.success(variable);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('VARIABLE_ERROR', `Failed get env var by name "${name}": ${message}`),
                'SqliteVariableRepository.getEnvVarByName'
            );
            return Result.failure(`Failed to get env var by name: ${message}`);
        }
    }

    private invalidateEnvVarCache(name?: string): void {
        this.loggerService.debug(`Invalidating env var cache ${name ? `for "${name}"` : '(general)'}.`);
        this.dbRepo.removeFromCache(this.CACHE_KEYS.ALL_ENV_VARS);
        this.dbRepo.removeFromCache(this.CACHE_KEYS.GLOBAL_ENV_VARS);
        this.dbRepo.removeFromCache(this.CACHE_KEYS.ALL_UNIQUE_VARS);

        if (name) {
            const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
            this.dbRepo.removeFromCache(this.CACHE_KEYS.ENV_VAR_BY_NAME(normalizedName));
        }

        this.loggerService.debug('Env var cache invalidation process completed.');
    }
}
