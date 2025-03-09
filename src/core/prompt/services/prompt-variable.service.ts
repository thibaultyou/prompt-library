import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { PromptService } from './prompt.service';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { EnvVariable, PromptFragment, PromptVariable } from '../../../shared/types';
import { FragmentService } from '../../fragment/services/fragment.service';
import { VariableService } from '../../variable/services/variable.service';

@Injectable({ scope: Scope.DEFAULT })
export class PromptVariableService {
    constructor(
        @Inject(forwardRef(() => PromptService))
        private readonly promptService: PromptService,
        @Inject(forwardRef(() => VariableService))
        private readonly variableService: VariableService,
        @Inject(forwardRef(() => FragmentService))
        private readonly fragmentService: FragmentService,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService
    ) {}

    public async getVariableSuggestions(
        variable: PromptVariable
    ): Promise<{ fragments: PromptFragment[]; envVars: EnvVariable[] }> {
        this.loggerService.debug(`Getting suggestions for variable: ${variable.name}`);
        const fragmentsResult = await this.fragmentService.getAllFragments();
        const envVarsResult = await this.variableService.getAllVariables();
        const fragments = fragmentsResult.success ? (fragmentsResult.data ?? []) : [];
        const envVars = envVarsResult.success ? (envVarsResult.data ?? []) : [];
        const suggestedEnvVars = this.promptService.getMatchingEnvironmentVariables(variable, envVars);
        return { fragments: fragments, envVars: suggestedEnvVars };
    }
}
