import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import { FileSystemService } from '../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { FRAGMENT_PREFIX, ERROR_MESSAGES, ENV_PREFIX } from '../../shared/constants';
import { EnvVariable, ApiResult, Result } from '../../shared/types';
import { EnvVariableFacade } from '../facades/env-variable.facade';
import { FragmentFacade } from '../facades/fragment.facade';

@Injectable({ scope: Scope.DEFAULT })
export class InputResolverService {
    constructor(
        private readonly fragmentFacade: FragmentFacade,
        private readonly envVariableFacade: EnvVariableFacade,
        private readonly stringFormatterService: StringFormatterService,
        private readonly fsService: FileSystemService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    public async resolveValue(value: string, envVars: EnvVariable[]): Promise<ApiResult<string>> {
        try {
            if (value.startsWith(FRAGMENT_PREFIX)) {
                const fragmentPath = value.substring(FRAGMENT_PREFIX.length);
                const [category, name] = fragmentPath.split('/');

                if (!category || !name) {
                    return Result.failure(`Invalid fragment reference format: ${value}`);
                }

                const fragmentResult = await this.fragmentFacade.getFragmentContent(category, name);

                if (fragmentResult.success && fragmentResult.data !== undefined) {
                    return Result.success(fragmentResult.data);
                } else {
                    const errorMessage = `Failed to load fragment: ${fragmentPath}`;
                    this.loggerService.warn(errorMessage);
                    return Result.failure(ERROR_MESSAGES.FRAGMENT_CONTENT_FAILED, { data: `<${errorMessage}>` });
                }
            } else if (value.startsWith(ENV_PREFIX)) {
                const envVarNameRef = value.substring(ENV_PREFIX.length);
                const normalizedRefName = this.stringFormatterService.normalizeVariableName(envVarNameRef, true);
                const actualEnvVar = envVars.find(
                    (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === normalizedRefName
                );

                if (actualEnvVar) {
                    const envVarValue = actualEnvVar.value;

                    if (envVarValue.startsWith(ENV_PREFIX) || envVarValue.startsWith(FRAGMENT_PREFIX)) {
                        this.loggerService.debug(`Resolving nested reference in env var "${envVarNameRef}"`);
                        return await this.resolveValue(envVarValue, envVars);
                    }
                    return Result.success(envVarValue);
                } else {
                    const errorMessage = `Env var not found: ${envVarNameRef}`;
                    this.loggerService.warn(errorMessage);
                    return Result.failure(
                        ERROR_MESSAGES.VARIABLE_NOT_FOUND.replace('{0}', envVarNameRef).replace('{1}', 'Not set'),
                        { data: `<${errorMessage}>` }
                    );
                }
            } else if (value.startsWith('file:')) {
                const filePath = value.substring('file:'.length);
                const contentResult = await this.fsService.readFileContent(filePath);

                if (contentResult.success && contentResult.data !== undefined) {
                    this.loggerService.debug(`Resolved value from file: ${filePath}`);
                    return Result.success(contentResult.data);
                } else {
                    const errorMessage = contentResult.error || `Failed read file input ${filePath}`;
                    this.loggerService.error(errorMessage);
                    return Result.failure(errorMessage, { data: `<Error reading file: ${filePath}>` });
                }
            }
            return Result.success(value);
        } catch (error) {
            const errorMessage = `Error resolving value: ${error instanceof Error ? error.message : String(error)}`;
            this.loggerService.error(errorMessage);
            return Result.failure(errorMessage);
        }
    }

    public async resolveInputs(inputs: Record<string, string>): Promise<ApiResult<Record<string, string>>> {
        try {
            const envVarsResult = await this.envVariableFacade.getAllVariables();
            const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
            const resolvedInputs: Record<string, string> = {};
            const resolutionPromises = Object.entries(inputs).map(async ([key, value]) => {
                const resolveResult = await this.resolveValue(value, envVars);
                resolvedInputs[key] = resolveResult.data ?? `<Error: ${resolveResult.error}>`;
            });
            await Promise.all(resolutionPromises);
            return Result.success(resolvedInputs);
        } catch (error) {
            const errorMessage = `Error resolving inputs: ${error instanceof Error ? error.message : String(error)}`;
            this.loggerService.error(errorMessage);
            return Result.failure(ERROR_MESSAGES.VARIABLE_SOURCES_FAILED.replace('{0}', errorMessage));
        }
    }
}
