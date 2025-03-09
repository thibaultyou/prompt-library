import { Injectable, Scope } from '@nestjs/common';

import { ExecutionService } from '../../core/execution/services/execution.service';
import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import {
    ApiResult,
    ConversationManager,
    PromptMetadata,
    FileInputOptions,
    DynamicVariableOptions,
    Result
} from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ExecutionFacade {
    constructor(
        private readonly executionService: ExecutionService,
        private readonly stringFormatterService: StringFormatterService
    ) {}

    async executePromptById(
        promptId: string,
        userInputs: Record<string, string>
    ): Promise<ApiResult<ConversationManager>> {
        return this.executionService.executePromptById(promptId, userInputs);
    }

    async executePromptWithMetadata(
        promptContent: string,
        metadata: PromptMetadata,
        dynamicOptions?: DynamicVariableOptions,
        fileInputs?: FileInputOptions,
        options?: { isJsonMode?: boolean; isVerbose?: boolean; shouldShowFullOutput?: boolean }
    ): Promise<ApiResult<string>> {
        const inputsToResolve: Record<string, string> = {};

        for (const variable of metadata.variables || []) {
            const varNameWithBraces = variable.name;
            const varNameKey = varNameWithBraces.replace(/[{}]/g, '');
            const snakeCaseName = this.stringFormatterService.formatSnakeCase(varNameKey);

            if (dynamicOptions && snakeCaseName in dynamicOptions) {
                inputsToResolve[varNameWithBraces] = dynamicOptions[snakeCaseName];
            } else if (fileInputs && snakeCaseName in fileInputs) {
                inputsToResolve[varNameWithBraces] = `file:${fileInputs[snakeCaseName]}`;
            } else if (variable.value) {
                inputsToResolve[varNameWithBraces] = variable.value;
            } else if (!variable.optional_for_user) {
                return Result.failure(`Missing required variable: ${snakeCaseName}`);
            } else {
                inputsToResolve[varNameWithBraces] = ' ';
            }
        }
        return this.executionService.executePromptWithMetadata(promptContent, metadata, inputsToResolve, options);
    }
}
