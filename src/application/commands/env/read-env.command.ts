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
import { ENV_UI, ERROR_MESSAGES, WARNING_MESSAGES } from '../../../shared/constants';
import { EnvReadCommandOptions } from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { EnvCommandService } from '../../services/env-command.service';

interface IParsedReadEnvOptions extends EnvReadCommandOptions {
    name?: string;
    value?: boolean;
    sources?: boolean;
    showTitles?: boolean;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'read',
    description: ENV_UI.DESCRIPTIONS.READ_COMMAND,
    aliases: ['get', 'view']
})
export class ReadEnvCommand extends EnvBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedReadEnvOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('reading variable info', async () => {
            const isJsonOutput = this.isJsonOutput(opts);

            if (!opts.name) {
                const isInteractive = this.isInteractiveMode(opts);

                if (!isInteractive) {
                    this.handleMissingArguments(
                        isJsonOutput,
                        'Variable name required via --name.',
                        'Provide --name option.'
                    );
                    return;
                }

                await this.showInfoInteractive();
                return;
            }

            const formattedName = this.stringFormatterService.normalizeVariableName(opts.name, true);

            if (opts.value) await this.viewVariableValueCmd(formattedName, isJsonOutput);
            else if (opts.sources)
                await this.showVariableSourcesCmd(formattedName, opts.showTitles ?? false, isJsonOutput);
            else await this.showVariableInfoCmd(formattedName, isJsonOutput);
        });
    }

    @Option({ flags: '--name <n>', description: ENV_UI.OPTIONS.INFO_OPTION })
    parseName(val: string): string {
        return val;
    }

    @Option({ flags: '--value', description: ENV_UI.OPTIONS.VALUE_ONLY })
    parseValueFlag(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--sources', description: ENV_UI.OPTIONS.SOURCES })
    parseSourcesFlag(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--show-titles', description: ENV_UI.OPTIONS.SHOW_TITLES })
    parseShowTitles(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--json', description: ENV_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async showInfoInteractive(): Promise<void> {
        await this.executeWithErrorHandling('showing variable info interactively', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(ENV_UI.SECTION_HEADER.VARIABLE_INFO, ENV_UI.SECTION_HEADER.ICON);
            const variableNameInput = await this.getInput(ENV_UI.INPUT.VARIABLE_NAME, { allowCancel: true });

            if (variableNameInput === null) {
                this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
                return;
            }

            const formattedName = this.stringFormatterService.normalizeVariableName(variableNameInput, true);
            const infoType = await this.selectMenu<'detail' | 'value' | 'sources' | 'back'>(
                ENV_UI.MENU.INFO_TYPE_PROMPT,
                [
                    { name: ENV_UI.LABELS.DETAILED_INFO, value: 'detail' },
                    { name: ENV_UI.LABELS.VARIABLE_VALUE, value: 'value' },
                    { name: ENV_UI.LABELS.PROMPT_SOURCES, value: 'sources' }
                ]
            );

            if (infoType === 'back') return;

            if (infoType === 'detail') await this.showVariableInfoCmd(formattedName, false);
            else if (infoType === 'value') await this.viewVariableValueCmd(formattedName, false);
            else if (infoType === 'sources') {
                const showTitles = await this.confirmAction(ENV_UI.MESSAGES.SHOW_PROMPT_TITLES_CONFIRM);
                await this.showVariableSourcesCmd(formattedName, showTitles, false);
            }

            await this.pressKeyToContinue();
        });
    }

    private async showVariableInfoCmd(name: string, jsonOutput: boolean): Promise<void> {
        const infoResult = await this.envCommandService.getVariableInfo(name);

        if (jsonOutput) {
            this.writeJsonResponse({ success: infoResult.success, error: infoResult.error, data: infoResult.data });
        } else if (!infoResult.success || !infoResult.data) {
            this.loggerService.error(ERROR_MESSAGES.VARIABLE_INFO_FAILED, infoResult.error || 'Unknown error');
        } else {
            this.displayVariableInfo(infoResult.data);
        }
    }

    private async viewVariableValueCmd(name: string, jsonOutput: boolean): Promise<void> {
        const { envVars } = await this.loadEnvironmentVariables();
        const variableResult = await this.envCommandService.viewVariableValue(name, envVars);

        if (jsonOutput) {
            this.writeJsonResponse({
                success: variableResult.success,
                error: variableResult.error,
                data: variableResult.data
            });
        } else if (!variableResult.success || !variableResult.data) {
            this.loggerService.error(ERROR_MESSAGES.VARIABLE_NOT_FOUND, name, variableResult.error || 'Unknown error');
        } else {
            this.displayVariableValue(variableResult.data);
        }
    }

    private async showVariableSourcesCmd(name: string, showTitles: boolean, jsonOutput: boolean): Promise<void> {
        const { allVariables } = await this.loadEnvironmentVariables();
        const sourcesResult = await this.envCommandService.getVariableSources(name, allVariables, showTitles);

        if (jsonOutput) {
            this.writeJsonResponse({
                success: sourcesResult.success,
                error: sourcesResult.error,
                data: sourcesResult.data
            });
        } else if (!sourcesResult.success || !sourcesResult.data) {
            this.loggerService.error(ERROR_MESSAGES.VARIABLE_SOURCES_FAILED, sourcesResult.error || 'Unknown error');
        } else {
            this.displayVariableSources(sourcesResult.data, showTitles);
        }
    }
}
