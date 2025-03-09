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
import { EnvCreateCommandOptions, EnvCreationAction } from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { EnvCommandService } from '../../services/env-command.service';

interface IParsedCreateEnvOptions extends EnvCreateCommandOptions {
    keyValue?: string;
    fragment?: string;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'create',
    description: ENV_UI.DESCRIPTIONS.CREATE_COMMAND
})
export class CreateEnvCommand extends EnvBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedCreateEnvOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('creating variable', async () => {
            const isJsonOutput = this.isJsonOutput(opts);

            if (opts.keyValue) {
                await this.handleKeyValueCreation(opts.keyValue, isJsonOutput);
                return;
            }

            if (opts.fragment) {
                await this.handleFragmentCreation(opts.fragment, isJsonOutput);
                return;
            }

            const isInteractive = this.isInteractiveMode(opts);

            if (isInteractive) {
                await this.createNewVariableInteractive();
            } else {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Missing arguments. Use --key-value or --fragment.',
                    'Provide --key-value or --fragment in non-interactive mode.'
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

    @Option({ flags: '--json', description: ENV_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async handleKeyValueCreation(keyValueParam: string, isJsonOutput: boolean): Promise<void> {
        const parsedKeyValue = this.processKeyValueParam(keyValueParam, isJsonOutput, 'Invalid format. Use key=value');

        if (!parsedKeyValue) return;

        const result = await this.envCommandService.createNewVariable(parsedKeyValue.key, parsedKeyValue.value);

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: result.success,
                error: result.error,
                data: { name: parsedKeyValue.key, value: parsedKeyValue.value }
            });
        } else if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_CREATED, parsedKeyValue.key);
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_CREATE_FAILED,
                parsedKeyValue.key,
                result.error || 'Unknown error'
            );
        }
    }

    private async handleFragmentCreation(fragmentParam: string, isJsonOutput: boolean): Promise<void> {
        const parsedFragment = this.processFragmentParam(fragmentParam, isJsonOutput);

        if (!parsedFragment) return;

        const result = await this.envCommandService.createVariableWithFragment(
            parsedFragment.key,
            parsedFragment.category,
            parsedFragment.name
        );

        if (isJsonOutput) {
            this.writeJsonResponse({ success: result.success, error: result.error, data: result.data });
        } else if (result.success) {
            const fragmentPath = `${parsedFragment.category}/${parsedFragment.name}`;
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_CREATED, parsedFragment.key);
            this.loggerService.success(SUCCESS_MESSAGES.FRAGMENT_REFERENCE_ASSIGNED, fragmentPath);

            if (result.data) await this.displayFragmentPreview(parsedFragment.category, parsedFragment.name);
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_CREATE_FAILED,
                parsedFragment.key,
                result.error || 'Unknown error'
            );
        }
    }

    private async createNewVariableInteractive(): Promise<void> {
        await this.executeWithErrorHandling('creating variable interactively', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(ENV_UI.SECTION_HEADER.CREATE, ENV_UI.SECTION_HEADER.CREATE_ICON);
            const variableNameInput = await this.getInput(ENV_UI.INPUT.VARIABLE_NAME, { allowCancel: true });

            if (variableNameInput === null) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const formattedName = this.stringFormatterService.normalizeVariableName(variableNameInput, true);
            const createType = await this.selectMenu<EnvCreationAction>(ENV_UI.MENU.CREATE_TYPE_PROMPT, [
                { name: ENV_UI.LABELS.SET_DIRECT_VALUE, value: ENV_UI.ACTIONS.VALUE },
                { name: ENV_UI.LABELS.SET_FRAGMENT_REF, value: ENV_UI.ACTIONS.FRAGMENT }
            ]);

            if (createType === ENV_UI.ACTIONS.BACK) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            if (createType === ENV_UI.ACTIONS.VALUE) await this.createVariableWithValue(formattedName);
            else await this.assignFragmentToNewVariable(formattedName);

            await this.pressKeyToContinue();
        });
    }

    private async createVariableWithValue(variableName: string): Promise<void> {
        this.uiFacade.print('Enter value. Press Ctrl+C to cancel.', 'dim');
        const value = await this.getInput(ENV_UI.INPUT.ENTER_VALUE, { allowCancel: true });

        if (value === null) {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return;
        }

        const result = await this.envCommandService.createNewVariable(variableName, value);

        if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_CREATED, variableName);
            this.uiFacade.print(ENV_UI.HINTS.VARIABLE_CREATED_HINT, 'info');
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_CREATE_FAILED,
                variableName,
                result.error || 'Unknown error'
            );
            this.uiFacade.print(ENV_UI.HINTS.TROUBLESHOOTING_HINTS, 'info');
            this.uiFacade.print('- Try simpler name (uppercase, numbers, underscores)');
            this.uiFacade.print('- Check database access');
        }
    }

    private async assignFragmentToNewVariable(variableName: string): Promise<void> {
        const selectedFragment = await this.selectFragment(ENV_UI.MENU.FRAGMENT_PROMPT);

        if (!selectedFragment) return;

        this.uiFacade.printSeparator(ENV_UI.SEPARATOR.CHAR, ENV_UI.SEPARATOR.LENGTH);
        this.uiFacade.print(INFO_MESSAGES.CREATING_WITH_FRAGMENT, 'info');
        const result = await this.envCommandService.createVariableWithFragment(
            variableName,
            selectedFragment.category,
            selectedFragment.name
        );

        if (result.success) {
            const fragmentPath = `${selectedFragment.category}/${selectedFragment.name}`;
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_CREATED, variableName);
            this.loggerService.success(SUCCESS_MESSAGES.FRAGMENT_REFERENCE_ASSIGNED, fragmentPath);
            await this.displayFragmentPreview(selectedFragment.category, selectedFragment.name);
        } else {
            this.loggerService.error(
                ERROR_MESSAGES.VARIABLE_CREATE_FAILED,
                variableName,
                result.error || 'Unknown error'
            );
        }
    }
}
