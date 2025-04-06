import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { FlushCommandService } from '../../../infrastructure/database/services/flush.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { CONFIG_UI } from '../../../shared/constants';
import { ConfigCommandOptions } from '../../../shared/types';
import { ConfigCommandService } from '../../services/config-command.service';
import { ConfigInteractionOrchestratorService } from '../../services/config-interaction-orchestrator.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedConfigOptions extends ConfigCommandOptions {
    key?: string;
    value?: string;
    reset?: boolean;
    flush?: boolean;
    nonInteractive?: boolean;
    json?: boolean;
}

@Injectable()
@Command({
    name: 'config',
    description: CONFIG_UI.DESCRIPTIONS.COMMAND,
    options: { isDefault: false }
})
export class ConfigCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly configCommandService: ConfigCommandService,
        private readonly flushCommandService: FlushCommandService,
        private readonly configInteractionOrchestratorService: ConfigInteractionOrchestratorService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParam: string[], options?: IParsedConfigOptions): Promise<void> {
        const opts = options || {};

        try {
            await this.executeAction(opts);
        } catch (error) {
            this.handleError(error, 'config command');
        }
    }

    @Option({ flags: '-k, --key <key>', description: CONFIG_UI.OPTIONS.KEY_OPTION })
    parseKey(val: string): string {
        return val;
    }
    @Option({ flags: '-v, --value <value>', description: CONFIG_UI.OPTIONS.VALUE_OPTION })
    parseValue(val: string): string {
        return val;
    }
    @Option({ flags: '-r, --reset', description: CONFIG_UI.OPTIONS.RESET_OPTION })
    parseReset(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '-f, --flush', description: CONFIG_UI.OPTIONS.FLUSH_OPTION })
    parseFlush(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '-n, --nonInteractive', description: CONFIG_UI.OPTIONS.NON_INTERACTIVE })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '-j, --json', description: CONFIG_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    public async executeAction(options: IParsedConfigOptions): Promise<void> {
        const isInteractive = this.isInteractiveMode(options);
        const isJsonOutput = this.isJsonOutput(options);

        if (!isInteractive) {
            await this.handleNonInteractiveMode(options, isJsonOutput);
        } else {
            await this.configInteractionOrchestratorService.startConfigInteractionWorkflow(this);
        }
    }

    private async handleNonInteractiveMode(options: IParsedConfigOptions, isJsonOutput: boolean): Promise<void> {
        if (options.flush) {
            const confirmResult = await this.flushCommandService.confirmFlush(this);

            if (confirmResult.success && confirmResult.data) {
                await this.flushCommandService.performFlush();
            } else {
                this.loggerService.warn('Flush cancelled or confirmation failed.');
            }
            return;
        }

        if (options.reset) {
            const result = this.configCommandService.resetConfig();

            if (isJsonOutput) this.writeJsonResponse({ success: result.success, error: result.error });
            return;
        }

        if (options.key) {
            if (options.value) {
                const result = this.configCommandService.setConfigValue(options.key, options.value);

                if (isJsonOutput)
                    this.writeJsonResponse({
                        success: result.success,
                        error: result.error,
                        data: { key: options.key, value: options.value }
                    });
            } else {
                this.configCommandService.viewConfigKey(options.key);

                if (isJsonOutput) {
                    const configResult = this.configCommandService.getConfig();
                    const value =
                        configResult.success && configResult.data
                            ? configResult.data[options.key as keyof typeof configResult.data]
                            : undefined;
                    this.writeJsonResponse({ success: configResult.success, error: configResult.error, data: value });
                }
            }
            return;
        }

        this.handleMissingArguments(isJsonOutput, CONFIG_UI.HELP.MISSING_OPTIONS, CONFIG_UI.HELP.MISSING_OPTIONS_JSON);
    }
}
