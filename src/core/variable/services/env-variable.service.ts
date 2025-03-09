import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { FRAGMENT_PREFIX, ERROR_MESSAGES, SENSITIVE_DATA_PATTERNS } from '../../../shared/constants';
import { ApiResult, EnvVariable, Result, VariableDetailInfo } from '../../../shared/types';
import { IFragmentRepository } from '../../fragment/repositories/fragment.repository.interface';
import { IVariableRepository } from '../repositories/variable.repository.interface';

@Injectable({ scope: Scope.DEFAULT })
export class EnvVariableService {
    constructor(
        @Inject(IVariableRepository) private readonly variableRepo: IVariableRepository,
        @Inject(IFragmentRepository) private readonly fragmentRepo: IFragmentRepository,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService
    ) {}

    async getAllVariables(): Promise<ApiResult<EnvVariable[]>> {
        this.loggerService.debug('EnvVariableService: Getting all variables.');
        return this.variableRepo.getAllEnvVars();
    }

    async getVariableByName(name: string): Promise<ApiResult<EnvVariable | null>> {
        this.loggerService.debug(`EnvVariableService: Getting variable by name "${name}".`);
        return this.variableRepo.getEnvVarByName(name);
    }

    async createVariable(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`EnvVariableService: Creating variable "${normalizedName}".`);

        try {
            const existing = await this.variableRepo.getEnvVarByName(normalizedName);

            if (existing.success && existing.data) {
                return Result.failure(`Variable "${normalizedName}" already exists.`);
            }

            if (!existing.success && !existing.error?.includes('not found')) {
                return Result.failure(existing.error || 'Failed check for existing variable.');
            }
            return await this.variableRepo.addEnvVar(normalizedName, value, 'global');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`EnvVariableService: Failed create variable "${normalizedName}": ${message}`);
            return Result.failure(`Failed to create variable ${name}: ${message}`);
        }
    }

    async updateVariableByName(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`EnvVariableService: Updating variable "${normalizedName}".`);

        try {
            return await this.variableRepo.addEnvVar(normalizedName, value, 'global');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`EnvVariableService: Failed update variable "${normalizedName}": ${message}`);
            return Result.failure(`Failed to update variable ${name}: ${message}`);
        }
    }

    async unsetVariableByName(name: string): Promise<ApiResult<void>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`EnvVariableService: Unsetting variable "${normalizedName}".`);

        try {
            const existing = await this.variableRepo.getEnvVarByName(normalizedName);

            if (!existing.success) return Result.failure(existing.error || `Failed check variable "${name}".`);

            if (!existing.data) {
                this.loggerService.warn(`Variable "${name}" not found.`);
                return Result.failure(`Variable "${name}" not found.`);
            }
            return await this.variableRepo.deleteEnvVar(existing.data.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`EnvVariableService: Failed unset variable "${name}": ${message}`);
            return Result.failure(`Failed to unset variable ${name}: ${message}`);
        }
    }

    async setFragmentVariable(name: string, fragmentPath: string): Promise<ApiResult<EnvVariable>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`EnvVariableService: Setting var "${normalizedName}" to fragment "${fragmentPath}".`);

        try {
            const pathParts = fragmentPath.split('/');

            if (pathParts.length !== 2 || !pathParts[0] || !pathParts[1]) {
                return Result.failure(`Invalid fragment path: "${fragmentPath}". Use "category/name".`);
            }

            const [category, fragmentName] = pathParts;
            const fragmentExists = await this.fragmentRepo.getFragmentContent(category, fragmentName);

            if (!fragmentExists.success) {
                return Result.failure(`Fragment "${fragmentPath}" not found or cannot be read.`);
            }

            const fragmentReference = `${FRAGMENT_PREFIX}${fragmentPath}`;
            return await this.variableRepo.addEnvVar(normalizedName, fragmentReference, 'global');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`EnvVariableService: Failed set fragment var "${name}": ${message}`);
            return Result.failure(`Failed to set fragment variable ${name}: ${message}`);
        }
    }

    async getFragmentContentForVariable(variable: EnvVariable): Promise<ApiResult<string>> {
        this.loggerService.debug(`EnvVariableService: Getting fragment content for var "${variable.name}".`);

        if (!variable.value?.startsWith(FRAGMENT_PREFIX)) {
            return Result.failure(`Variable "${variable.name}" is not a fragment reference.`);
        }

        const fragmentPath = variable.value.substring(FRAGMENT_PREFIX.length);
        const [category, name] = fragmentPath.split('/');

        if (!category || !name) return Result.failure(`Invalid fragment ref format: ${fragmentPath}`);
        return this.fragmentRepo.getFragmentContent(category, name);
    }

    async getAllUniqueVariables(): Promise<Array<{ name: string; role: string; promptIds: string[] }>> {
        this.loggerService.debug('EnvVariableService: Getting all unique variables.');
        const result = await this.variableRepo.getAllUniqueVariables();

        if (!result.success) {
            this.loggerService.error(`Failed get unique vars: ${result.error}`);
            return [];
        }
        return result.data || [];
    }

    async getPromptsUsingVariable(name: string): Promise<ApiResult<string[]>> {
        this.loggerService.debug(`EnvVariableService: Getting prompts using variable "${name}".`);
        return this.variableRepo.getPromptsUsingVariable(name);
    }

    isSensitiveVariable(variable: EnvVariable): boolean {
        if (!variable?.name) return false;

        const upperName = variable.name.toUpperCase();
        return SENSITIVE_DATA_PATTERNS.KEY_PATTERNS.some((pattern) => upperName.includes(pattern));
    }

    async getVariableInfo(name: string): Promise<ApiResult<VariableDetailInfo>> {
        const normalizedName = this.stringFormatterService.normalizeVariableName(name, true);
        this.loggerService.debug(`EnvVariableService: Getting detailed info for var "${normalizedName}".`);

        try {
            const allUniqueVarsResult = await this.variableRepo.getAllUniqueVariables();

            if (!allUniqueVarsResult.success || !allUniqueVarsResult.data) {
                return Result.failure(allUniqueVarsResult.error || 'Failed get unique var list.');
            }

            const variableInfo = allUniqueVarsResult.data.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === normalizedName
            );

            if (!variableInfo)
                return Result.failure(
                    ERROR_MESSAGES.VARIABLE_NOT_FOUND.replace('{0}', name).replace('{1}', 'Not found.')
                );

            const envVarResult = await this.variableRepo.getEnvVarByName(normalizedName);
            const envVar = envVarResult.success ? envVarResult.data : null;
            const isSet = !!envVar && !!envVar.value && envVar.value.trim() !== '';
            const isFragment = isSet && envVar!.value.startsWith(FRAGMENT_PREFIX);
            const isSensitive = envVar ? this.isSensitiveVariable(envVar) : false;
            let fragmentContent: string | undefined;

            if (isFragment && envVar) {
                const contentResult = await this.getFragmentContentForVariable(envVar);

                if (contentResult.success) fragmentContent = contentResult.data;
                else
                    this.loggerService.warn(
                        `Could not load fragment content for "${normalizedName}": ${contentResult.error}`
                    );
            }

            const displayValue = isSet ? (isSensitive ? '********' : envVar!.value) : undefined;
            return Result.success({
                name: normalizedName,
                description: variableInfo.role,
                inferred: variableInfo.promptIds.length > 0,
                promptIds: variableInfo.promptIds,
                value: displayValue,
                isSet,
                isFragment,
                fragmentContent
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`EnvVariableService: Error getting info for var "${name}": ${message}`);
            return Result.failure(ERROR_MESSAGES.VARIABLE_INFO_FAILED.replace('{0}', message));
        }
    }
}
