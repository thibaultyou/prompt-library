import { Injectable } from '@nestjs/common';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { TextFormatter } from '../../../infrastructure/ui/components/text.formatter';
import { VariableTableRenderer } from '../../../infrastructure/ui/components/variable-table.renderer';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { ENV_UI, ERROR_MESSAGES, INFO_MESSAGES, STYLE_TYPES, WARNING_MESSAGES } from '../../../shared/constants';
import {
    EnvVariableInfo,
    EnvVariable,
    VariableDetailInfo,
    VariableValueInfo,
    VariableSourceInfo,
    PromptFragment
} from '../../../shared/types';
import { EnvVariableFacade } from '../../facades/env-variable.facade';
import { FragmentFacade } from '../../facades/fragment.facade';
import { DomainCommandRunner } from '../base/domain-command.runner';

@Injectable()
export abstract class EnvBaseCommandRunner extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        protected readonly envVariableFacade: EnvVariableFacade,
        protected readonly fragmentFacade: FragmentFacade,
        protected readonly stringFormatterService: StringFormatterService,
        protected readonly textFormatter: TextFormatter,
        protected readonly variableTableRenderer: VariableTableRenderer
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    protected async loadEnvironmentVariables(): Promise<{
        allVariables: EnvVariableInfo[];
        envVars: EnvVariable[];
    }> {
        const allVariables = await this.envVariableFacade.getAllUniqueVariables();
        const envVarsResult = await this.envVariableFacade.getAllVariables();
        const envVarsData = this.handleApiResultSync<EnvVariable[]>(envVarsResult, INFO_MESSAGES.FETCHED_ENV_VARIABLES);
        return { allVariables, envVars: envVarsData || [] };
    }

    protected processKeyValueParam(
        keyValueParam: string,
        isJsonOutput: boolean,
        errorMessage: string = ERROR_MESSAGES.INVALID_FORMAT_SET
    ): { key: string; value: string } | null {
        const [key, value] = keyValueParam.split('=');

        if (!key || value === undefined) {
            this.handleMissingArguments(isJsonOutput, errorMessage, errorMessage);
            return null;
        }
        return { key: this.stringFormatterService.normalizeVariableName(key, true), value };
    }

    protected processFragmentParam(
        fragmentParam: string,
        isJsonOutput: boolean
    ): { key: string; category: string; name: string } | null {
        const [key, fragmentPath] = fragmentParam.split('=');

        if (!key || !fragmentPath) {
            this.handleMissingArguments(
                isJsonOutput,
                ERROR_MESSAGES.INVALID_FORMAT_FRAGMENT,
                ERROR_MESSAGES.INVALID_FORMAT_FRAGMENT
            );
            return null;
        }

        const formattedKey = this.stringFormatterService.normalizeVariableName(key, true);
        const pathParts = fragmentPath.trim().split('/');

        if (pathParts.length !== 2) {
            this.handleMissingArguments(
                isJsonOutput,
                ENV_UI.MESSAGES.INVALID_FRAGMENT_PATH,
                ENV_UI.MESSAGES.INVALID_FRAGMENT_PATH
            );
            return null;
        }
        return { key: formattedKey, category: pathParts[0], name: pathParts[1] };
    }

    protected async selectFragment(
        promptMessage: string = ENV_UI.MENU.FRAGMENT_PROMPT
    ): Promise<PromptFragment | null> {
        const fragmentsResult = await this.fragmentFacade.getAllFragments();
        const fragments = this.handleApiResultSync(fragmentsResult, INFO_MESSAGES.FETCHED_FRAGMENTS) as
            | PromptFragment[]
            | null;

        if (!fragments || fragments.length === 0) {
            this.loggerService.warn(WARNING_MESSAGES.NO_FRAGMENTS_FOUND);
            return null;
        }

        const selectedFragment = await this.selectMenu<PromptFragment | string>(
            promptMessage,
            fragments.map((f) => ({
                name: `${f.category} > ${this.textFormatter.style(f.name, STYLE_TYPES.INFO)}`,
                value: f
            }))
        );

        if (typeof selectedFragment === 'string' && selectedFragment === 'back') {
            this.loggerService.warn(WARNING_MESSAGES.OPERATION_CANCELLED);
            return null;
        }

        if (typeof selectedFragment !== 'string') {
            return selectedFragment as PromptFragment;
        }
        return null;
    }

    protected displayVariableInfo(info: VariableDetailInfo): void {
        this.uiFacade.print(`\nVariable: ${info.name}`, 'bold', STYLE_TYPES.SUCCESS);
        this.uiFacade.print(`${ENV_UI.LABELS.DESCRIPTION} ${info.description || 'No description'}`);
        this.uiFacade.print(`Status: ${info.isSet ? ENV_UI.STATUS.SET : ENV_UI.STATUS.NOT_SET}`);

        if (info.isSet && info.value) {
            if (info.isFragment) {
                this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.FRAGMENT_REFERENCE}`);
                this.uiFacade.print(`${ENV_UI.LABELS.REFERENCE} ${info.value}`);

                if (info.fragmentContent) {
                    this.uiFacade.print(`\n${ENV_UI.LABELS.FRAGMENT_CONTENT}`);
                    this.uiFacade.printSeparator(ENV_UI.SEPARATOR.CHAR, ENV_UI.SEPARATOR.LENGTH);
                    this.uiFacade.print(
                        info.fragmentContent.substring(0, 500) + (info.fragmentContent.length > 500 ? '...' : '')
                    );
                }
            } else {
                this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.DIRECT_VALUE}`);
                this.uiFacade.print(`${ENV_UI.LABELS.VALUE} ${info.value}`);
            }
        }

        this.uiFacade.print(`\nSource Info:`);
        this.uiFacade.print(`Inferred: ${info.inferred ? 'Yes' : 'No'}`);

        if (info.promptIds && info.promptIds.length > 0) {
            this.uiFacade.print(`Used in ${info.promptIds.length} prompt(s):`);
            this.uiFacade.print(info.promptIds.map((id) => `- [${id}]`).join('\n'));
        } else if (!info.inferred) {
            this.uiFacade.print(ENV_UI.STATUS.CUSTOM_VARIABLE);
        }
    }

    protected displayVariableValue(varInfo: VariableValueInfo): void {
        this.uiFacade.print(`\n${ENV_UI.LABELS.VARIABLE_NAME} ${varInfo.name}`, 'bold', STYLE_TYPES.SUCCESS);

        if (varInfo.isFragmentReference) {
            this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.FRAGMENT_REFERENCE}`);
            this.uiFacade.print(`${ENV_UI.LABELS.REFERENCE} ${varInfo.reference}`);

            if (varInfo.fragmentContent) {
                this.uiFacade.print(`\n${ENV_UI.LABELS.FRAGMENT_CONTENT}`);
                this.uiFacade.printSeparator(ENV_UI.SEPARATOR.CHAR, ENV_UI.SEPARATOR.LENGTH);
                this.uiFacade.print(varInfo.fragmentContent);
            } else {
                this.loggerService.error(ERROR_MESSAGES.FRAGMENT_CONTENT_FAILED);
            }
        } else {
            this.uiFacade.print(`${ENV_UI.LABELS.TYPE} ${ENV_UI.STATUS.DIRECT_VALUE}`);

            if (varInfo.isSensitive) {
                this.uiFacade.print(`${ENV_UI.LABELS.VALUE} ${ENV_UI.STATUS.SENSITIVE_VALUE}`, 'warning');
            } else {
                this.uiFacade.print(`${ENV_UI.LABELS.VALUE} ${varInfo.value ?? '<Not Set>'}`);
            }
        }
    }

    protected displayVariableSources(variableInfo: VariableSourceInfo, showTitles: boolean): void {
        this.uiFacade.print(`\n${ENV_UI.LABELS.VARIABLE_NAME} ${variableInfo.name}`, 'bold', STYLE_TYPES.SUCCESS);
        this.uiFacade.print(`${ENV_UI.LABELS.DESCRIPTION} ${variableInfo.description || 'No description'}`);
        this.uiFacade.print(`${ENV_UI.LABELS.USED_IN} ${variableInfo.promptIds.length} prompt(s):\n`);

        if (variableInfo.promptIds.length === 0) {
            this.loggerService.warn(WARNING_MESSAGES.CUSTOM_VARIABLE);
            return;
        }

        if (showTitles && variableInfo.prompts) {
            variableInfo.prompts.forEach((p) => this.uiFacade.print(`- [${p.id}] ${p.title}`));
        } else {
            this.uiFacade.print(variableInfo.promptIds.map((id) => `- ${id}`).join('\n'));
        }
    }

    protected async displayFragmentPreview(category: string, name: string): Promise<void> {
        this.uiFacade.print('\nFragment content preview:', 'info');
        const contentResult = await this.fragmentFacade.getFragmentContent(category, name);

        if (contentResult.success && contentResult.data) {
            this.uiFacade.printSeparator(ENV_UI.SEPARATOR.CHAR, ENV_UI.SEPARATOR.LENGTH);
            this.uiFacade.print(contentResult.data.substring(0, 200) + (contentResult.data.length > 200 ? '...' : ''));
        } else {
            this.uiFacade.print(WARNING_MESSAGES.FRAGMENT_CONTENT_PREVIEW_FAILED, 'warning');
        }
    }

    abstract run(passedParams: string[], options?: Record<string, any>): Promise<void>;
}
