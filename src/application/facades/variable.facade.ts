import { Injectable, Scope } from '@nestjs/common';

import { VariableService } from '../../core/variable/services/variable.service';
import { ApiResult, EnvVariable, VariableDetailInfo } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class VariableFacade {
    constructor(private readonly variableService: VariableService) {}

    async getAllVariables(): Promise<ApiResult<EnvVariable[]>> {
        return this.variableService.getAllVariables();
    }
    async getVariableByName(name: string): Promise<ApiResult<EnvVariable | null>> {
        return this.variableService.getVariableByName(name);
    }
    async createVariable(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        return this.variableService.createVariable(name, value);
    }
    async setVariable(name: string, value: string): Promise<ApiResult<EnvVariable>> {
        return this.variableService.setVariable(name, value);
    }
    async setFragmentVariable(name: string, fragmentPath: string): Promise<ApiResult<EnvVariable>> {
        return this.variableService.setFragmentVariable(name, fragmentPath);
    }
    async unsetVariable(name: string): Promise<ApiResult<void>> {
        return this.variableService.unsetVariable(name);
    }
    async getFragmentContent(variable: EnvVariable): Promise<ApiResult<string>> {
        return this.variableService.getFragmentContentForVariable(variable);
    }
    async getAllUniqueVariables(): Promise<Array<{ name: string; role: string; promptIds: string[] }>> {
        return this.variableService.getAllUniqueVariables();
    }
    async getPromptsUsingVariable(name: string): Promise<ApiResult<string[]>> {
        return this.variableService.getPromptsUsingVariable(name);
    }
    async getVariableInfo(name: string): Promise<ApiResult<VariableDetailInfo>> {
        return this.variableService.getVariableInfo(name);
    }
    isSensitiveVariable(variable: EnvVariable): boolean {
        return this.variableService.isSensitiveVariable(variable);
    }
}
