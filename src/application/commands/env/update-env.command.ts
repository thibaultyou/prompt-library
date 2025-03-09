import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { EnvBaseCommandRunner } from './base-env.command.runner';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { TextFormatter } from '../../../infrastructure/ui/components/text.formatter';
import { VariableTableRenderer } from '../../../infrastructure/ui/components/variable-table.renderer';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { ENV_UI, SUCCESS_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES, INFO_MESSAGES } from '../../../shared/constants';
import { EnvUpdateCommandOptions } from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { EnvCommandService } from '../../services/env-command.service';

interface IParsedUpdateEnvOptions extends EnvUpdateCommandOptions {
    keyValue?: string;
    fragment?: string;
    clear?: string;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'update',
    description: ENV_UI.DESCRIPTIONS.UPDATE_COMMAND,
    aliases: ['set']
})
export class UpdateEnvCommand extends EnvBaseCommandRunner {
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
        private readonly envCommandService: EnvCommandService
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

    async run(passedParams: string[], options?: IParsedUpdateEnvOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('updating variable', async () => {
            const isJsonOutput = this.isJsonOutput(opts);

            if (opts.clear) await this.handleClearVariable(opts.clear, isJsonOutput);
            else if (opts.keyValue) await this.handleUpdateKeyValue(opts.keyValue, isJsonOutput);
            else if (opts.fragment) await this.handleUpdateFragment(opts.fragment, isJsonOutput);
            else {
                const isInteractive = this.isInteractiveMode(opts);

                if (isInteractive) await this.updateVariableInteractive();
                else
                    this.handleMissingArguments(
                        isJsonOutput,
                        'Missing arguments. Use --key-value, --fragment, or --clear.',
                        'Provide --key-value, --fragment, or --clear in non-interactive mode.'
                    );
            }
        });
    }

    @Option({ flags: '--key-value <key=value>', description: ENV_UI.OPTIONS.SET_OPTION })
    parseKeyValue(val: string): string {
        return val;
    }

    @Option({ flags: '--fragment <key=category/name>', description: ENV_UI.OPTIONS.FRAGMENT_OPTION })
    parseFragment(val: string): string {
        return val;
    }

    @Option({ flags: '--clear <key>', description: ENV_UI.OPTIONS.UNSET_OPTION })
    parseClear(val: string): string {
        return val;
    }

    @Option({ flags: '--json', description: ENV_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async handleClearVariable(key: string, isJsonOutput: boolean): Promise<void> {
        const formattedName = this.stringFormatterService.normalizeVariableName(key, true);
        const result = await this.envCommandService.setVariable(formattedName, '');

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: result.success,
                error: result.error,
                data: { name: formattedName, value: '' }
            });
        } else if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_UNSET, formattedName);
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_UNSET_FAILED,
                formattedName,
                result.error || 'Unknown error'
            );
        }
    }

    private async handleUpdateKeyValue(keyValue: string, isJsonOutput: boolean): Promise<void> {
        const parsedKeyValue = this.processKeyValueParam(keyValue, isJsonOutput);

        if (!parsedKeyValue) return;

        const result = await this.envCommandService.setVariable(parsedKeyValue.key, parsedKeyValue.value);

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: result.success,
                error: result.error,
                data: { name: parsedKeyValue.key, value: parsedKeyValue.value }
            });
        } else if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_SET, parsedKeyValue.key);
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_SET_FAILED,
                parsedKeyValue.key,
                result.error || 'Unknown error'
            );
        }
    }

    private async handleUpdateFragment(fragmentParam: string, isJsonOutput: boolean): Promise<void> {
        const parsedFragment = this.processFragmentParam(fragmentParam, isJsonOutput);

        if (!parsedFragment) return;

        const fragmentPath = `${parsedFragment.category}/${parsedFragment.name}`;
        const result = await this.envCommandService.setFragmentVariable(parsedFragment.key, fragmentPath);

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: result.success,
                error: result.error,
                data: { name: parsedFragment.key, fragmentPath }
            });
        } else if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.FRAGMENT_VARIABLE_SET, parsedFragment.key, fragmentPath);
        } else {
            this.loggerService.error(ERROR_MESSAGES.FRAGMENT_VARIABLE_SET_FAILED, result.error || 'Unknown error');
        }
    }

    private async updateVariableInteractive(): Promise<void> {
        await this.executeWithErrorHandling('updating variable interactively', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                ENV_UI.SECTION_HEADER.UPDATE_VARIABLE,
                ENV_UI.SECTION_HEADER.MANAGEMENT_ICON
            );
            const variableNameInput = await this.getInput(ENV_UI.INPUT.VARIABLE_NAME, { allowCancel: true });

            if (variableNameInput === null) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const formattedName = this.stringFormatterService.normalizeVariableName(variableNameInput, true);
            const updateType = await this.selectMenu<'value' | 'fragment' | 'clear' | 'back'>(
                ENV_UI.MENU.UPDATE_TYPE_PROMPT,
                [
                    { name: ENV_UI.LABELS.SET_DIRECT_VALUE, value: 'value' },
                    { name: ENV_UI.LABELS.SET_FRAGMENT_REF, value: 'fragment' },
                    { name: ENV_UI.LABELS.CLEAR_VALUE, value: 'clear' }
                ]
            );

            if (updateType === 'back') {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            let success = false;

            if (updateType === 'clear') success = await this.clearVariableValueInteractive(formattedName);
            else if (updateType === 'value') success = await this.updateVariableWithValueInteractive(formattedName);
            else success = await this.updateVariableWithFragmentInteractive(formattedName);

            if (success) await this.pressKeyToContinue();
        });
    }

    private async clearVariableValueInteractive(variableName: string): Promise<boolean> {
        const confirm = await this.confirmAction(`Clear value of ${variableName}?`);

        if (!confirm) {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return false;
        }

        const result = await this.envCommandService.setVariable(variableName, '');

        if (result.success) this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_UNSET, variableName);
        else this.loggerService.error(ERROR_MESSAGES.VARIABLE_UNSET_FAILED, variableName, result.error || 'Unknown');
        return result.success;
    }

    private async updateVariableWithValueInteractive(variableName: string): Promise<boolean> {
        this.uiFacade.print(INFO_MESSAGES.SETTING_VARIABLE.replace('{0}', variableName), 'info');
        this.uiFacade.print(ENV_UI.MESSAGES.ENTER_NEW_VALUE, 'dim');
        const value = await this.getInput(ENV_UI.INPUT.ENTER_VALUE, { allowCancel: true });

        if (value === null) {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return false;
        }

        const confirm = await this.confirmAction(
            `Update ${variableName} to "${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"?`
        );

        if (!confirm) {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return false;
        }

        const result = await this.envCommandService.setVariable(variableName, value);

        if (result.success) this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_SET, variableName);
        else this.loggerService.error(ERROR_MESSAGES.VARIABLE_SET_FAILED, variableName, result.error || 'Unknown');
        return result.success;
    }

    private async updateVariableWithFragmentInteractive(variableName: string): Promise<boolean> {
        this.uiFacade.print(
            INFO_MESSAGES.SETTING_FRAGMENT_VARIABLE.replace('{0}', variableName).replace('{1}', ''),
            'info'
        );
        const selectedFragment = await this.selectFragment();

        if (!selectedFragment) return false;

        const fragmentPath = `${selectedFragment.category}/${selectedFragment.name}`;
        const confirm = await this.confirmAction(`Update ${variableName} to reference fragment "${fragmentPath}"?`);

        if (!confirm) {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return false;
        }

        const result = await this.envCommandService.setFragmentVariable(variableName, fragmentPath);

        if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.FRAGMENT_VARIABLE_SET, variableName, fragmentPath);
            await this.displayFragmentPreview(selectedFragment.category, selectedFragment.name);
        } else {
            this.loggerService.error(ERROR_MESSAGES.FRAGMENT_VARIABLE_SET_FAILED, result.error || 'Unknown');
        }
        return result.success;
    }
}
