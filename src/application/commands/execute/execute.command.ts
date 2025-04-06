import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { EXECUTE_UI } from '../../../shared/constants';
import { ExecuteCommandOptions, FileInputOptions, DynamicVariableOptions } from '../../../shared/types';
import { ExecuteCommandService } from '../../services/execution-command.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedExecuteOptions extends ExecuteCommandOptions {
    prompt?: string;
    promptFile?: string;
    metadataFile?: string;
    inspect?: boolean;
    fileInput?: FileInputOptions;
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@Command({
    name: 'execute',
    description: EXECUTE_UI.DESCRIPTIONS.COMMAND,
    options: { isDefault: false }
})
export class ExecuteCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly executeCommandService: ExecuteCommandService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedExecuteOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('execute command', async () => {
            const commandOptions = this.parseAllOptionsFromArgv();

            if (commandOptions.promptId) {
                await this.executeCommandService.handleStoredPrompt(
                    this,
                    commandOptions.promptId,
                    commandOptions.dynamicOptions,
                    commandOptions.inspect,
                    commandOptions.fileInputs
                );
            } else if (commandOptions.promptFile && commandOptions.metadataFile) {
                await this.executeCommandService.handleFilePrompt(
                    this,
                    commandOptions.promptFile,
                    commandOptions.metadataFile,
                    commandOptions.dynamicOptions,
                    commandOptions.inspect,
                    commandOptions.fileInputs
                );
            } else if (this.isInteractiveMode(opts)) {
                await this.executeCommandService.browseAndRunWorkflow(
                    this,
                    commandOptions.inspect,
                    commandOptions.fileInputs
                );
            } else {
                this.handleMissingArguments(
                    this.isJsonOutput(opts),
                    EXECUTE_UI.ERRORS.PROMPT_ID_REQUIRED,
                    EXECUTE_UI.ERRORS.PROMPT_ID_REQUIRED_JSON
                );
            }
        });
    }

    @Option({ flags: '-p, --prompt <id_or_name>', description: EXECUTE_UI.OPTIONS.PROMPT_ID })
    parsePrompt(val: string): string {
        return val;
    }

    @Option({ flags: '-f, --prompt-file <file>', description: EXECUTE_UI.OPTIONS.PROMPT_FILE })
    parsePromptFile(val: string): string {
        return val;
    }

    @Option({ flags: '-m, --metadata-file <file>', description: EXECUTE_UI.OPTIONS.METADATA_FILE })
    parseMetadataFile(val: string): string {
        return val;
    }

    @Option({ flags: '-i, --inspect', description: EXECUTE_UI.OPTIONS.INSPECT })
    parseInspect(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '-j, --json', description: 'Output in JSON format' })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '-n, --nonInteractive', description: 'Run without prompts', defaultValue: true })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private parseAllOptionsFromArgv(): {
        promptId?: string;
        promptFile?: string;
        metadataFile?: string;
        inspect: boolean;
        fileInputs: FileInputOptions;
        dynamicOptions: DynamicVariableOptions;
    } {
        const args = process.argv;
        const options: ReturnType<typeof this.parseAllOptionsFromArgv> = {
            inspect: false,
            fileInputs: {},
            dynamicOptions: {}
        };

        for (let i = 2; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];

            if ((arg === '-p' || arg === '--prompt') && nextArg && !nextArg.startsWith('-')) {
                options.promptId = nextArg;
                i++;
            } else if ((arg === '-f' || arg === '--prompt-file') && nextArg && !nextArg.startsWith('-')) {
                options.promptFile = nextArg;
                i++;
            } else if ((arg === '-m' || arg === '--metadata-file') && nextArg && !nextArg.startsWith('-')) {
                options.metadataFile = nextArg;
                i++;
            } else if (arg === '-i' || arg === '--inspect') {
                options.inspect = true;
            } else if ((arg === '-fi' || arg === '--file-input') && nextArg && !nextArg.startsWith('-')) {
                const [variable, file] = nextArg.split('=');

                if (variable && file) options.fileInputs[variable] = file;

                i++;
            } else if (
                arg.startsWith('--') &&
                !['--json', '--nonInteractive', '--help', '-h', '-V', '--version'].includes(arg)
            ) {
                const key = arg.slice(2).replace(/-/g, '_');

                if (nextArg && !nextArg.startsWith('-')) {
                    options.dynamicOptions[key] = nextArg;
                    i++;
                } else {
                    options.dynamicOptions[key] = 'true';
                }
            }
        }
        return options;
    }
}
