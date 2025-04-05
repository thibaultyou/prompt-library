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
import { ENV_UI, SUCCESS_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES } from '../../../shared/constants';
import { EnvDeleteCommandOptions } from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { EnvCommandService } from '../../services/env-command.service';

interface IParsedDeleteEnvOptions extends EnvDeleteCommandOptions {
    name?: string;
    force?: boolean;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'delete',
    description: ENV_UI.DESCRIPTIONS.DELETE_COMMAND
})
export class DeleteEnvCommand extends EnvBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedDeleteEnvOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('deleting variable', async () => {
            const isJsonOutput = this.isJsonOutput(opts);

            if (opts.name) {
                await this.handleDeleteByName(opts.name, opts.force ?? false, isJsonOutput);
                return;
            }

            const isInteractive = this.isInteractiveMode(opts);

            if (isInteractive) {
                await this.deleteVariableInteractive();
            } else {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Variable name required via --name in non-interactive mode.',
                    'Provide --name option in non-interactive mode.'
                );
            }
        });
    }

    @Option({ flags: '--name <n>', description: ENV_UI.OPTIONS.DELETE_OPTION })
    parseName(val: string): string {
        return val;
    }

    @Option({ flags: '--force', description: ENV_UI.OPTIONS.FORCE_DELETE })
    parseForce(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--json', description: ENV_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async handleDeleteByName(name: string, force: boolean, isJsonOutput: boolean): Promise<void> {
        const formattedName = this.stringFormatterService.normalizeVariableName(name, true);
        const { allVariables } = await this.loadEnvironmentVariables();
        const variable = allVariables.find(
            (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
        );

        if (variable && variable.promptIds && variable.promptIds.length > 0) {
            const errorMsg = `Cannot delete inferred variable "${formattedName}". Used by ${variable.promptIds.length} prompt(s).`;

            if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
            else this.loggerService.error(ERROR_MESSAGES.VARIABLE_UNSET_FAILED, errorMsg);
            return;
        }

        const needsConfirmation = this.isInteractiveMode({}) && !force;
        let confirmed = force || !needsConfirmation;

        if (needsConfirmation) {
            confirmed = await this.confirmAction(`Are you sure you want to delete custom variable ${formattedName}?`);
        }

        if (!this.isInteractiveMode({}) && !force && !confirmed) {
            if (isJsonOutput)
                this.writeJsonResponse({
                    success: false,
                    error: 'Use --force to confirm deletion in non-interactive mode.'
                });
            else
                this.loggerService.error(
                    ERROR_MESSAGES.INVALID_INPUT,
                    'Use --force to confirm deletion in non-interactive mode.'
                );
            return;
        }

        if (!confirmed) {
            if (isJsonOutput) this.writeJsonResponse({ success: false, error: 'Deletion cancelled by user.' });
            else this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return;
        }

        const result = await this.envCommandService.deleteVariable(formattedName);

        if (isJsonOutput) {
            this.writeJsonResponse({ success: result.success, error: result.error, data: { name: formattedName } });
        } else if (result.success) {
            this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_UNSET, formattedName);
        } else {
            this.loggerService.error(ERROR_MESSAGES.VARIABLE_UNSET_FAILED, result.error || 'Unknown error');
        }
    }

    private async deleteVariableInteractive(): Promise<void> {
        await this.executeWithErrorHandling('deleting variable interactively', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Delete Environment Variable', ENV_UI.SECTION_HEADER.MANAGEMENT_ICON);
            const variableNameInput = await this.getInput(ENV_UI.INPUT.VARIABLE_NAME, { allowCancel: true });

            if (variableNameInput === null) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const formattedName = this.stringFormatterService.normalizeVariableName(variableNameInput, true);
            const { allVariables } = await this.loadEnvironmentVariables();
            const variable = allVariables.find(
                (v) => this.stringFormatterService.normalizeVariableName(v.name, true) === formattedName
            );

            if (variable && variable.promptIds && variable.promptIds.length > 0) {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(ENV_UI.SECTION_HEADER.CANNOT_DELETE_INFERRED, '⚠️');
                this.uiFacade.print(ENV_UI.MESSAGES.INFERRED_VARIABLE_WARNING.replace('{0}', formattedName), 'warning');
                this.uiFacade.print(
                    ENV_UI.MESSAGES.USED_IN_PROMPTS.replace('{0}', String(variable.promptIds.length)),
                    'warning'
                );
                this.uiFacade.print('');
                this.uiFacade.print(ENV_UI.HINTS.INFERRED_VARIABLES_INFO, 'info');
                this.uiFacade.print(ENV_UI.HINTS.UPDATE_COMMAND_HINT, 'info');
                await this.pressKeyToContinue();
                return;
            }

            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(ENV_UI.SECTION_HEADER.DELETE_CONFIRMATION, '⚠️');
            this.uiFacade.print(ENV_UI.MESSAGES.DELETE_WARNING.replace('{0}', formattedName), 'warning');
            this.uiFacade.print(ENV_UI.MESSAGES.ACTION_IRREVERSIBLE, 'warning');
            const confirm = await this.confirmAction(`Are you sure you want to delete ${formattedName}?`);

            if (!confirm) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const result = await this.envCommandService.deleteVariable(formattedName);

            if (result.success) this.loggerService.success(SUCCESS_MESSAGES.VARIABLE_UNSET, formattedName);
            else this.loggerService.error(ERROR_MESSAGES.VARIABLE_UNSET_FAILED, result.error || 'Unknown error');

            await this.pressKeyToContinue();
        });
    }
}
