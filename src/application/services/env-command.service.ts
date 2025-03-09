import { Injectable, Scope } from '@nestjs/common';
import chalk from 'chalk';

import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { VariableTableRenderer } from '../../infrastructure/ui/components/variable-table.renderer';
import { FRAGMENT_PREFIX } from '../../shared/constants';
import {
    EnvVariable,
    ApiResult,
    Result,
    VariableDetailInfo,
    VariableValueInfo,
    VariableSourceInfo
} from '../../shared/types';
import { EnvVariableFacade } from '../facades/env-variable.facade';
import { FragmentFacade } from '../facades/fragment.facade';
import { PromptFacade } from '../facades/prompt.facade';

@Injectable({ scope: Scope.DEFAULT })
export class EnvCommandService {
    constructor(
        private readonly envVariableFacade: EnvVariableFacade,
        private readonly promptFacade: PromptFacade,
        private readonly fragmentFacade: FragmentFacade,
        private readonly loggerService: LoggerService,
        private readonly stringFormatterService: StringFormatterService,
        private readonly variableTableRenderer: VariableTableRenderer
    ) {}

    public async listEnvironmentVariables(
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        envVars: EnvVariable[]
    ): Promise<ApiResult<string>> {
        try {
            const tableData = this.variableTableRenderer.formatEnvironmentVariablesTable(allVariables, envVars);
            let output = tableData.headers + '\n' + tableData.separator + '\n';
            output += tableData.rows.join('\n') + '\n' + tableData.separator + '\n';
            output += chalk.cyan(`Total variables: ${allVariables.length} (${envVars.length} set)`);
            return Result.success(output);
        } catch (error) {
            this.loggerService.error('LIST_ENV_VARIABLES_ERROR', 'Error listing environment variables:', error);
            return Result.failure(
                `Failed to list environment variables: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async setVariable(name: string, value: string): Promise<ApiResult<void>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const result = await this.envVariableFacade.setVariable(formattedName, value);
            return { success: result.success, error: result.error };
        } catch (error) {
            this.loggerService.error('SET_VARIABLE_ERROR', 'Error setting variable:', error);
            return Result.failure(`Failed to set variable: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async setFragmentVariable(name: string, fragmentPath: string): Promise<ApiResult<void>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const result = await this.envVariableFacade.setFragmentVariable(formattedName, fragmentPath);
            return { success: result.success, error: result.error };
        } catch (error) {
            this.loggerService.error('SET_FRAGMENT_VARIABLE_ERROR', 'Error setting fragment variable:', error);
            return Result.failure(
                `Failed to set fragment variable: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async deleteVariable(name: string): Promise<ApiResult<void>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const uniqueVars = await this.envVariableFacade.getAllUniqueVariables();
            const matchingVar = uniqueVars.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );

            if (matchingVar && matchingVar.promptIds && matchingVar.promptIds.length > 0) {
                return Result.failure(
                    `Cannot delete inferred variable "${formattedName}". Used by ${matchingVar.promptIds.length} prompt(s).`
                );
            }

            const result = await this.envVariableFacade.unsetVariable(formattedName);
            return result;
        } catch (error) {
            this.loggerService.error('DELETE_VARIABLE_ERROR', 'Error deleting variable:', error);
            return Result.failure(
                `Failed to delete variable: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async createNewVariable(name: string, value: string): Promise<ApiResult<void>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const existingVar = await this.envVariableFacade.getVariableByName(formattedName);

            if (existingVar.success && existingVar.data) {
                return Result.failure(`Variable "${formattedName}" already exists. Use update command.`);
            }

            const result = await this.envVariableFacade.createVariable(formattedName, value);
            return { success: result.success, error: result.error };
        } catch (error) {
            this.loggerService.error('CREATE_VARIABLE_ERROR', 'Error creating variable:', error);
            return Result.failure(
                `Failed to create variable: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getVariableInfo(name: string): Promise<ApiResult<VariableDetailInfo>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const infoResult = await this.envVariableFacade.getVariableInfo(formattedName);

            if (!infoResult.success || !infoResult.data) {
                return Result.failure(infoResult.error || 'Failed to get variable info');
            }

            const info = infoResult.data;

            if (info.promptIds && info.promptIds.length > 0) {
                const prompts = [];

                for (const promptId of info.promptIds) {
                    const promptResult = await this.promptFacade.getPromptById(parseInt(promptId));
                    prompts.push({
                        id: promptId,
                        title: promptResult.success && promptResult.data ? promptResult.data.title : 'Unknown'
                    });
                }
                (info as VariableDetailInfo).prompts = prompts;
            }
            return Result.success(info as VariableDetailInfo);
        } catch (error) {
            this.loggerService.error('GET_VARIABLE_INFO_ERROR', 'Error getting variable info:', error);
            return Result.failure(
                `Failed to get variable info: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async viewVariableValue(name: string, envVars: EnvVariable[]): Promise<ApiResult<VariableValueInfo>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const envVar = envVars.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );

            if (!envVar) {
                return Result.failure(`Variable ${formattedName} not found or not set`);
            }

            const result: VariableValueInfo = {
                name: formattedName,
                valueType: 'direct',
                isFragmentReference: false,
                isSensitive: this.envVariableFacade.isSensitiveVariable(envVar)
            };

            if (envVar.value.startsWith(FRAGMENT_PREFIX)) {
                result.valueType = 'fragment';
                result.isFragmentReference = true;
                result.reference = envVar.value;
                const fragmentResult = await this.envVariableFacade.getFragmentContent(envVar);

                if (fragmentResult.success) {
                    result.fragmentContent = fragmentResult.data;
                }
            } else {
                result.valueType = 'direct';
                result.value = result.isSensitive ? undefined : envVar.value;
            }
            return Result.success(result);
        } catch (error) {
            this.loggerService.error('VIEW_VARIABLE_ERROR', 'Error viewing variable value:', error);
            return Result.failure(
                `Failed to view variable value: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getVariableSources(
        name: string,
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        showTitles: boolean
    ): Promise<ApiResult<VariableSourceInfo>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const variable = allVariables.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );

            if (!variable) {
                return Result.failure(`Variable ${formattedName} not found`);
            }

            const result: VariableSourceInfo = {
                name: formattedName,
                description: variable.role,
                promptIds: variable.promptIds || []
            };

            if (showTitles && result.promptIds.length > 0) {
                const prompts = [];

                for (const promptId of result.promptIds) {
                    const promptResult = await this.promptFacade.getPromptById(parseInt(promptId));
                    prompts.push({
                        id: promptId,
                        title: promptResult.success && promptResult.data ? promptResult.data.title : 'Unknown'
                    });
                }
                result.prompts = prompts;
            }
            return Result.success(result);
        } catch (error) {
            this.loggerService.error('GET_VARIABLE_SOURCES_ERROR', 'Error getting variable sources:', error);
            return Result.failure(
                `Failed to get variable sources: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async createVariableWithFragment(
        variableName: string,
        fragmentCategory: string,
        fragmentName: string
    ): Promise<
        ApiResult<{
            variable: { id: string | number; name: string };
            fragmentPath: string;
            fragmentContent: string | null;
        }>
    > {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(variableName, true);
            const existingVar = await this.envVariableFacade.getVariableByName(formattedName);

            if (existingVar.success && existingVar.data) {
                return Result.failure(`Variable "${formattedName}" already exists. Use update.`);
            }

            const fragmentPath = `${fragmentCategory}/${fragmentName}`;
            const result = await this.envVariableFacade.setFragmentVariable(formattedName, fragmentPath);

            if (!result.success) {
                return Result.failure(result.error || `Failed to create variable with fragment ref`);
            }

            const fragmentContent = await this.fragmentFacade.getFragmentContent(fragmentCategory, fragmentName);
            return Result.success({
                variable: { name: formattedName, id: result.data?.id || '' },
                fragmentPath,
                fragmentContent: fragmentContent.success && fragmentContent.data ? fragmentContent.data : null
            });
        } catch (error) {
            this.loggerService.error(
                'CREATE_VARIABLE_WITH_FRAGMENT_ERROR',
                'Error creating variable with fragment:',
                error
            );
            return Result.failure(
                `Failed to create variable with fragment: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public validateVariableName(name: string): ApiResult<string> {
        try {
            if (!name || name.trim() === '') return Result.failure('Variable name cannot be empty');

            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);

            if (formattedName.length < 2) return Result.failure('Variable name too short after formatting');

            if (!/^[A-Z0-9_]+$/.test(formattedName))
                return Result.failure('Variable name must be uppercase letters, numbers, underscores');
            return Result.success(formattedName);
        } catch (error) {
            this.loggerService.error('VALIDATE_VARIABLE_NAME_ERROR', 'Error validating variable name:', error);
            return Result.failure(
                `Failed to validate variable name: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async isInferredVariable(name: string): Promise<ApiResult<boolean>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            const uniqueVars = await this.envVariableFacade.getAllUniqueVariables();
            const matchingVar = uniqueVars.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );

            if (!matchingVar) return Result.failure(`Variable ${formattedName} not found`);
            return Result.success(!!(matchingVar.promptIds && matchingVar.promptIds.length > 0));
        } catch (error) {
            this.loggerService.error('CHECK_INFERRED_VARIABLE_ERROR', 'Error checking if variable is inferred:', error);
            return Result.failure(
                `Failed to check if variable is inferred: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async unsetVariableByName(name: string): Promise<ApiResult<void>> {
        try {
            const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
            return await this.envVariableFacade.unsetVariable(formattedName);
        } catch (error) {
            this.loggerService.error('UNSET_VARIABLE_ERROR', 'Error unsetting variable:', error);
            return Result.failure(
                `Failed to unset variable: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
