import { Injectable, Scope } from '@nestjs/common';

import { EnvVariableService } from './env-variable.service';
import { ApiResult, EnvVariable, VariableDetailInfo } from '../../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class VariableService {
    constructor(private readonly envVarService: EnvVariableService) {}

    async getAllVariables(): Promise<ApiResult<EnvVariable[]>> {
        return this.envVarService.getAllVariables();
    }
    async createVariable(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        return this.envVarService.createVariable(name, value);
    }
    async updateVariableByName(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        return this.envVarService.updateVariableByName(name, value);
    }
    async setVariable(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        return this.updateVariableByName(name, value);
    }
    async unsetVariable(name: string): Promise<ApiResult<void>> {
        return this.envVarService.unsetVariableByName(name);
    }
    async getVariableByName(name: string): Promise<ApiResult<EnvVariable | null>> {
        return this.envVarService.getVariableByName(name);
    }
    async setFragmentVariable(name: string, fragmentPath: string): Promise<ApiResult<EnvVariable>> {
        return this.envVarService.setFragmentVariable(name, fragmentPath);
    }
    async getFragmentContentForVariable(variable: EnvVariable): Promise<ApiResult<string>> {
        return this.envVarService.getFragmentContentForVariable(variable);
    }
    async getAllUniqueVariables(): Promise<Array<{ name: string; role: string; promptIds: string[] }>> {
        return this.envVarService.getAllUniqueVariables();
    }
    async getPromptsUsingVariable(name: string): Promise<ApiResult<string[]>> {
        return this.envVarService.getPromptsUsingVariable(name);
    }
    async getVariableInfo(name: string): Promise<ApiResult<VariableDetailInfo>> {
        return this.envVarService.getVariableInfo(name);
    }
    isSensitiveVariable(variable: EnvVariable): boolean {
        return this.envVarService.isSensitiveVariable(variable);
    }
}
