import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { EnvBaseCommandRunner } from './base-env.command.runner';
import { CreateEnvCommand } from './create-env.command';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { TextFormatter } from '../../../infrastructure/ui/components/text.formatter';
import { VariableTableRenderer } from '../../../infrastructure/ui/components/variable-table.renderer';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import {
    FRAGMENT_PREFIX,
    ENV_UI,
    SUCCESS_MESSAGES,
    ERROR_MESSAGES,
    WARNING_MESSAGES,
    INFO_MESSAGES
} from '../../../shared/constants';
import { EnvListCommandOptions, EnvVariableInfo, EnvVariable, EnvManagementAction } from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { EnvCommandService } from '../../services/env-command.service';

interface IParsedListEnvOptions extends EnvListCommandOptions {
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'list',
    description: ENV_UI.DESCRIPTIONS.LIST_COMMAND,
    aliases: ['ls']
})
export class ListEnvCommand extends EnvBaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        envVariableFacade: EnvVariableFacade,
        fragmentFacade: FragmentFacade,
        stringFormatterService: StringFormatterService,
        textFormatter: TextFormatter,
        variableTableRenderer: VariableTableRenderer,
        private readonly envCommandService: EnvCommandService,
        private readonly promptFacade: PromptFacade,
        private readonly createEnvCmd: CreateEnvCommand
    ) {
        super(
            uiFacade,
            errorService,
            repositoryService,
            loggerService,
            envVariableFacade,
            fragmentFacade,
            stringFormatterService,
            textFormatter,
            variableTableRenderer
        );
    }

    async run(passedParams: string[], options?: IParsedListEnvOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('list environment variables', async () => {
            const { allVariables, envVars } = await this.loadEnvironmentVariables();

            if (this.isJsonOutput(opts)) {
                this.writeJsonResponse({
                    success: true,
                    data: {
                        variables: allVariables,
                        envVars: envVars.map((v) => ({
                            name: v.name,
                            isSet: true,
                            isFragment: v.value.startsWith(FRAGMENT_PREFIX),
                            value: v.value
                        }))
                    }
                });
                return;
            }

            const isInteractive = this.isInteractiveMode(opts);

            if (isInteractive) {
                await this.interactiveMode(allVariables, envVars);
            } else {
                await this.listEnvironmentVariablesNonInteractive(allVariables, envVars);
            }
        });
    }

    @Option({ flags: '--json', description: ENV_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async interactiveMode(initialAllVars: EnvVariableInfo[], initialEnvVars: EnvVariable[]): Promise<void> {
        let allVariables = initialAllVars;
        let envVars = initialEnvVars;
        while (true) {
            try {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(ENV_UI.SECTION_HEADER.TITLE, ENV_UI.SECTION_HEADER.ICON);
                const tableData = this.variableTableRenderer.formatEnvironmentVariablesTable(allVariables, envVars);
                const tableChoices = this.variableTableRenderer.createEnvVarMenuChoices(tableData, {
                    createVariableLabel: ENV_UI.LABELS.CREATE_VARIABLE,
                    infoText: `Found ${allVariables.length} vars (${envVars.length} set).`
                });
                const action = await this.selectMenu<EnvVariableInfo | 'back' | 'refresh' | 'create'>(
                    ENV_UI.MENU.PROMPT,
                    tableChoices as any
                );

                if (action === 'back') return;

                if (action === 'refresh') {
                    const refreshed = await this.refreshEnvironmentVariables();
                    allVariables = refreshed.updatedAllVariables;
                    envVars = refreshed.updatedEnvVars;
                    continue;
                }

                if (typeof action === 'object' && action.name === 'create') {
                    await this.createEnvCmd.run([], {});
                    const refreshed = await this.refreshEnvironmentVariables();
                    allVariables = refreshed.updatedAllVariables;
                    envVars = refreshed.updatedEnvVars;
                    continue;
                }

                if (typeof action === 'object' && action.name !== 'create') {
                    const selectedVar = action as EnvVariableInfo;
                    await this.manageEnvVar(selectedVar, envVars);
                    const refreshed = await this.refreshEnvironmentVariables();
                    allVariables = refreshed.updatedAllVariables;
                    envVars = refreshed.updatedEnvVars;
                }
            } catch (error) {
                this.handleError(error, 'interactive env list');
                await this.pressKeyToContinue();
            }
        }
    }

    private async refreshEnvironmentVariables(): Promise<{
        updatedEnvVars: EnvVariable[];
        updatedAllVariables: EnvVariableInfo[];
    }> {
        const refreshedEnvVarsResult = await this.envVariableFacade.getAllVariables();
        const updatedEnvVars = this.handleApiResultSync(refreshedEnvVarsResult) || [];
        const updatedAllVariables = await this.envVariableFacade.getAllUniqueVariables();
        return { updatedEnvVars, updatedAllVariables };
    }

    private async listEnvironmentVariablesNonInteractive(
        allVariables: EnvVariableInfo[],
        envVars: EnvVariable[]
    ): Promise<void> {
        const result = await this.envCommandService.listEnvironmentVariables(allVariables, envVars);

        if (result.success && result.data) this.uiFacade.print(result.data);
        else this.loggerService.error(ERROR_MESSAGES.LIST_VARIABLES_FAILED, result.error || 'Unknown error');
    }

    private async manageEnvVar(variable: EnvVariableInfo, envVars: EnvVariable[]): Promise<void> {
        await this.executeWithErrorHandling('managing variable', async () => {
            this.uiFacade.clearConsole();
            const formattedName = this.stringFormatterService.normalizeVariableName(variable.name, true);
            const existingVar = envVars.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );
            const isSet = !!existingVar?.value?.trim();
            const isFragment = !!existingVar?.value?.startsWith(FRAGMENT_PREFIX);
            this.uiFacade.printSectionHeader(
                `${ENV_UI.SECTION_HEADER.VARIABLE_MANAGEMENT}${formattedName}`,
                ENV_UI.SECTION_HEADER.MANAGEMENT_ICON
            );
            await this.displayVariableManagementInfo(variable, existingVar, isSet, isFragment);
            const choices = this.buildVariableManagementMenu(isSet, (variable.promptIds?.length ?? 0) > 0);
            const action = await this.selectMenu<EnvManagementAction>(ENV_UI.MENU.MANAGE_PROMPT, choices);

            if (action === ENV_UI.ACTIONS.BACK) return;

            await this.handleVariableManagementAction(action, formattedName);
        });
    }

    private async displayVariableManagementInfo(
        variable: EnvVariableInfo,
        existingVar: EnvVariable | undefined,
        isSet: boolean,
        isFragment: boolean
    ): Promise<void> {
        this.uiFacade.print(`${ENV_UI.LABELS.DESCRIPTION} ${variable.role || 'No description'}`, 'warning');
        this.uiFacade.print(
            `${ENV_UI.LABELS.STATUS} ${isSet ? ENV_UI.STATUS.SET : ENV_UI.STATUS.NOT_SET}`,
            isSet ? 'success' : 'error'
        );

        if (isSet && existingVar) {
            if (isFragment) {
                this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.FRAGMENT_REFERENCE}`, 'warning');
                this.uiFacade.print(`${ENV_UI.LABELS.REFERENCE} ${existingVar.value}`, 'warning');
                const fragmentResult = await this.envVariableFacade.getFragmentContent(existingVar);

                if (fragmentResult.success && fragmentResult.data) {
                    this.uiFacade.print(`\n${ENV_UI.LABELS.FRAGMENT_CONTENT}`, 'warning');
                    this.uiFacade.printSeparator();
                    this.uiFacade.print(
                        fragmentResult.data.substring(0, 200) + (fragmentResult.data.length > 200 ? '...' : '')
                    );
                }
            } else {
                this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.DIRECT_VALUE}`, 'warning');

                if (this.envVariableFacade.isSensitiveVariable(existingVar)) {
                    this.uiFacade.print(`${ENV_UI.LABELS.VALUE} ${ENV_UI.STATUS.SENSITIVE_VALUE}`, 'warning');
                } else {
                    this.uiFacade.print(`${ENV_UI.LABELS.VALUE} ${existingVar.value}`, 'warning');
                }
            }
        }

        const promptIds = variable.promptIds || [];
        this.uiFacade.print(`\n${ENV_UI.LABELS.USED_IN} ${promptIds.length} prompt(s)`, 'warning');

        if (promptIds.length > 0) {
            const promptsList = promptIds
                .slice(0, 5)
                .map((id) => `  - Prompt ${id}`)
                .join('\n');
            this.uiFacade.print(promptsList + (promptIds.length > 5 ? '\n  - ...' : ''));
        } else {
            this.uiFacade.print(`  ${ENV_UI.STATUS.CUSTOM_VARIABLE}`);
        }

        this.uiFacade.print('');
    }

    private buildVariableManagementMenu(
        isSet: boolean,
        hasPrompts: boolean
    ): Array<{ name: string; value: EnvManagementAction }> {
        const choices: Array<{ name: string; value: EnvManagementAction }> = [
            { name: ENV_UI.LABELS.SET_VALUE, value: ENV_UI.ACTIONS.SET },
            { name: ENV_UI.LABELS.SET_FRAGMENT, value: ENV_UI.ACTIONS.SET_FRAGMENT }
        ];

        if (isSet) choices.push({ name: ENV_UI.LABELS.UNSET, value: ENV_UI.ACTIONS.UNSET });

        if (hasPrompts) choices.push({ name: ENV_UI.LABELS.VIEW_PROMPTS, value: ENV_UI.ACTIONS.VIEW_PROMPTS });
        return choices;
    }

    private async handleVariableManagementAction(action: EnvManagementAction, variableName: string): Promise<void> {
        switch (action) {
            case ENV_UI.ACTIONS.SET:
                await this.setVariableInteractive(variableName);
                break;
            case ENV_UI.ACTIONS.SET_FRAGMENT:
                await this.setFragmentVariableInteractive(variableName);
                break;
            case ENV_UI.ACTIONS.UNSET:
                await this.unsetVariableInteractive(variableName);
                break;
            case ENV_UI.ACTIONS.VIEW_PROMPTS:
                await this.viewPromptsUsingVariable(variableName);
                break;
        }
    }

    private async setVariableInteractive(name: string): Promise<void> {
        await this.executeWithErrorHandling('setting variable interactively', async () => {
            this.uiFacade.print(`\n${INFO_MESSAGES.SETTING_VARIABLE.replace('{0}', name)}`, 'primary');
            this.uiFacade.print('Enter value. Ctrl+C to cancel.', 'dim');
            const value = await this.getInput(ENV_UI.INPUT.ENTER_VALUE, { allowCancel: true });

            if (value === null) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const confirm = await this.confirmAction(
                `Set ${name} to "${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"?`
            );

            if (!confirm) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const result = await this.envCommandService.setVariable(name, value);

            if (result.success) this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_SET, name);
            else this.loggerService.error(ERROR_MESSAGES.VARIABLE_SET_FAILED, name, result.error || 'Unknown error');

            await this.pressKeyToContinue();
        });
    }

    private async setFragmentVariableInteractive(name: string): Promise<void> {
        await this.executeWithErrorHandling('setting fragment variable interactively', async () => {
            this.uiFacade.print(
                `\n${INFO_MESSAGES.SETTING_FRAGMENT_VARIABLE.replace('{0}', name).replace('{1}', '')}`,
                'primary'
            );
            const selectedFragment = await this.selectFragment();

            if (!selectedFragment) return;

            const fragmentPath = `${selectedFragment.category}/${selectedFragment.name}`;
            const confirm = await this.confirmAction(`Set ${name} to reference fragment "${fragmentPath}"?`);

            if (!confirm) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const result = await this.envCommandService.setFragmentVariable(name, fragmentPath);

            if (result.success) {
                this.loggerService.success(SUCCESS_MESSAGES.FRAGMENT_VARIABLE_SET, name, fragmentPath);
                await this.displayFragmentPreview(selectedFragment.category, selectedFragment.name);
            } else {
                this.loggerService.error(ERROR_MESSAGES.FRAGMENT_VARIABLE_SET_FAILED, result.error || 'Unknown error');
            }

            await this.pressKeyToContinue();
        });
    }

    private async unsetVariableInteractive(name: string): Promise<void> {
        await this.executeWithErrorHandling('unsetting variable interactively', async () => {
            const confirm = await this.confirmAction(`Are you sure you want to unset ${name}?`);

            if (!confirm) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const result = await this.envCommandService.unsetVariableByName(name);

            if (result.success) this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_UNSET, name);
            else this.loggerService.error(ERROR_MESSAGES.VARIABLE_UNSET_FAILED, result.error || 'Unknown error');

            await this.pressKeyToContinue();
        });
    }

    private async viewPromptsUsingVariable(name: string): Promise<void> {
        await this.executeWithErrorHandling('viewing prompts using variable', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                `${ENV_UI.SECTION_HEADER.PROMPTS_USING}${name}`,
                ENV_UI.SECTION_HEADER.PROMPTS_ICON
            );
            const promptsResult = await this.envVariableFacade.getPromptsUsingVariable(name);

            if (!promptsResult.success) {
                this.loggerService.error(ERROR_MESSAGES.VARIABLE_PROMPTS_FAILED, promptsResult.error || 'Unknown');
                await this.pressKeyToContinue();
                return;
            }

            const promptIds = promptsResult.data;

            if (!promptIds || promptIds.length === 0) {
                this.loggerService.warn(WARNING_MESSAGES.NO_PROMPTS_FOUND);
                await this.pressKeyToContinue();
                return;
            }

            this.uiFacade.print(`Found ${promptIds.length} prompt(s) using this variable:`, 'primary');
            this.uiFacade.print('');

            for (const promptId of promptIds) {
                const prompt = await this.promptFacade.getPromptById(parseInt(promptId));

                if (prompt.success && prompt.data) {
                    this.uiFacade.print(`[${promptId}] ${prompt.data.title}`, 'success');
                    this.uiFacade.print(`  ${(prompt.data.description || '').substring(0, 100)}`, 'dim');
                    this.uiFacade.print('');
                } else {
                    this.uiFacade.print(`[${promptId}] (could not load prompt)`, 'warning');
                }
            }
            await this.pressKeyToContinue();
        });
    }
}
