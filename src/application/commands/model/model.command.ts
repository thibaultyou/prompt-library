import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { MODEL_UI, ModelProvider } from '../../../shared/constants';
import { ModelCommandOptions, ModelCommandAction, ApiResult } from '../../../shared/types';
import { ModelFacade } from '../../facades/model.facade';
import { ModelCommandService } from '../../services/model-command.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedModelOptions extends ModelCommandOptions {
    provider?: ModelProvider;
    model?: string;
    apiKey?: string;
    nonInteractive?: boolean;
    json?: boolean;
}

@Injectable()
@Command({
    name: 'model',
    description: MODEL_UI.DESCRIPTIONS.COMMAND
})
export class ModelCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly modelCommandService: ModelCommandService,
        private readonly modelFacade: ModelFacade
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedModelOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('model command', async () => {
            const isInteractive = this.isInteractiveMode(opts);
            const isJsonOutput = this.isJsonOutput(opts);

            if (!isInteractive) {
                await this.handleNonInteractiveMode(opts, isJsonOutput);
            } else {
                await this.handleInteractiveMode(isJsonOutput);
            }
        });
    }

    @Option({ flags: '-p, --provider <provider>', description: MODEL_UI.OPTIONS.PROVIDER })
    parseProvider(val: string): string {
        return val;
    }
    @Option({ flags: '-m, --model <model>', description: MODEL_UI.OPTIONS.MODEL })
    parseModel(val: string): string {
        return val;
    }
    @Option({ flags: '-k, --apiKey <key>', description: MODEL_UI.OPTIONS.API_KEY })
    parseApiKey(val: string): string {
        return val;
    }
    @Option({ flags: '-n, --nonInteractive', description: MODEL_UI.OPTIONS.NON_INTERACTIVE })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '-j, --json', description: MODEL_UI.OPTIONS.JSON })
    parseJson(val: boolean): boolean {
        return val;
    }

    private async handleNonInteractiveMode(options: IParsedModelOptions, isJsonOutput: boolean): Promise<void> {
        let result: ApiResult<void> | undefined;

        if (options.provider) {
            result = await this.modelCommandService.setModelProvider(options.provider);

            if (isJsonOutput)
                this.writeJsonResponse({
                    success: result.success,
                    error: result.error,
                    data: { provider: options.provider }
                });
        }

        if (options.model) {
            result = await this.modelCommandService.setModel(options.model);

            if (isJsonOutput)
                this.writeJsonResponse({
                    success: result.success,
                    error: result.error,
                    data: { model: options.model }
                });
        }

        if (options.apiKey) {
            result = await this.modelCommandService.setApiKey(options.apiKey);

            if (isJsonOutput)
                this.writeJsonResponse({
                    success: result.success,
                    error: result.error,
                    data: { apiKeyConfigured: result.success }
                });
        }

        if (!options.provider && !options.model && !options.apiKey) {
            await this.displayConfiguration(isJsonOutput);
        }
    }

    private async handleInteractiveMode(isJsonOutput: boolean): Promise<void> {
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(MODEL_UI.SECTION_HEADER.TITLE, MODEL_UI.SECTION_HEADER.ICON);
            await this.modelCommandService.displayModelConfiguration();
            const action = await this.selectMenu<ModelCommandAction>(MODEL_UI.MENU.PROMPT, [
                { name: MODEL_UI.MENU.OPTIONS.PROVIDER, value: MODEL_UI.ACTIONS.PROVIDER },
                { name: MODEL_UI.MENU.OPTIONS.MODEL, value: MODEL_UI.ACTIONS.MODEL },
                { name: MODEL_UI.MENU.OPTIONS.API_KEY, value: MODEL_UI.ACTIONS.KEY }
            ]);

            if (action === MODEL_UI.ACTIONS.BACK) return;

            await this.handleMenuAction(action, isJsonOutput);
        }
    }

    private async handleMenuAction(action: ModelCommandAction, isJsonOutput: boolean): Promise<void> {
        let result: ApiResult<void> | undefined;
        switch (action) {
            case MODEL_UI.ACTIONS.PROVIDER:
                result = await this.modelCommandService.configureModelProvider(this);

                if (isJsonOutput) {
                    const config = this.modelFacade.getModelConfig();
                    this.writeJsonResponse({
                        success: result.success,
                        error: result.error,
                        data: config.success ? { provider: config.data?.provider } : null
                    });
                }

                break;
            case MODEL_UI.ACTIONS.MODEL:
                result = await this.modelCommandService.selectAndUpdateModel(this);

                if (isJsonOutput) {
                    const config = this.modelFacade.getModelConfig();
                    this.writeJsonResponse({
                        success: result.success,
                        error: result.error,
                        data: config.success ? { model: config.data?.model } : null
                    });
                }

                break;
            case MODEL_UI.ACTIONS.KEY:
                result = await this.modelCommandService.configureApiKey(this);

                if (isJsonOutput) {
                    const config = this.modelFacade.getModelConfig();
                    this.writeJsonResponse({
                        success: result.success,
                        error: result.error,
                        data: config.success ? { apiKeyConfigured: config.data?.hasApiKey } : null
                    });
                }

                break;
        }

        if (action !== MODEL_UI.ACTIONS.BACK && !isJsonOutput) {
            await this.pressKeyToContinue();
        }
    }

    private async displayConfiguration(isJsonOutput: boolean): Promise<void> {
        await this.modelCommandService.displayModelConfiguration();

        if (isJsonOutput) {
            const config = this.modelFacade.getModelConfig();
            this.writeJsonResponse({ success: config.success, error: config.error, data: config.data });
        }
    }
}
