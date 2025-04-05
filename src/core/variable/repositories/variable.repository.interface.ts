import { ApiResult, EnvVariable } from '../../../shared/types';

export const IVariableRepository = Symbol('IVariableRepository');

export interface IVariableRepository {
    getAllUniqueVariables(): Promise<ApiResult<Array<{ name: string; role: string; promptIds: string[] }>>>;
    getPromptsUsingVariable(name: string): Promise<ApiResult<string[]>>;
    getAllEnvVars(): Promise<ApiResult<EnvVariable[]>>;
    addEnvVar(
        name: string,
        value: string,
        scope?: 'global' | 'prompt',
        promptId?: number
    ): Promise<ApiResult<EnvVariable>>;
    updateEnvVar(id: number, value: string): Promise<ApiResult<void>>;
    deleteEnvVar(id: number): Promise<ApiResult<void>>;
    getGlobalEnvVars(): Promise<ApiResult<EnvVariable[]>>;
    getPromptEnvVars(promptId: number | string): Promise<ApiResult<EnvVariable[]>>;
    getGlobalAndPromptEnvVars(promptId: number | string): Promise<ApiResult<EnvVariable[]>>;
    getEnvVarByName(name: string): Promise<ApiResult<EnvVariable | null>>;
}
