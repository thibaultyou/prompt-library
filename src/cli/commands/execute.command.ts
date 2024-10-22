import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { BaseCommand } from './base.command';
import { Metadata, Prompt, Variable } from '../../shared/types';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt_processing.util';
import { getPromptFiles } from '../utils/prompt_crud.util';
import { viewPromptDetails } from '../utils/prompt_display.util';

class ExecuteCommand extends BaseCommand {
    constructor() {
        super('execute', 'Execute or inspect a prompt');
        this.option('-p, --prompt <id>', 'Execute a stored prompt by ID')
            .option('-f, --prompt-file <file>', 'Path to the prompt file (usually prompt.md)')
            .option('-m, --metadata-file <file>', 'Path to the metadata file (usually metadata.yml)')
            .option('-i, --inspect', 'Inspect the prompt variables without executing')
            .option(
                '-fi, --file-input <variable>=<file>',
                'Specify a file to use as input for a variable',
                this.collect,
                {}
            )
            .allowUnknownOption(true)
            .addHelpText(
                'after',
                `
Dynamic Options:
  This command allows setting prompt variables dynamically using additional options.
  Variables can be set either by value or by file content.

Setting variables by value:
  Use --variable_name "value" format for each variable.

  Example:
  $ execute -f prompt.md -m metadata.yml --source_language english --target_language french

Setting variables by file content:
  Use -fi or --file-input option with variable=filepath format.

  Example:
  $ execute -f prompt.md -m metadata.yml -fi communication=input.txt

Combining value and file inputs:
  You can mix both methods in a single command.

  Example:
  $ execute -f prompt.md -m metadata.yml --source_language english -fi communication=input.txt --target_language french

Common Variables:
  While variables are prompt-specific, some common ones include:

  --safety_guidelines <value>             Set safety rules or ethical considerations
  --output_format <value>                 Set the structure and components of the final output
  --extra_guidelines_or_context <value>   Set additional information or instructions

Inspecting Variables:
  Use -i or --inspect to see all available variables for a specific prompt:
  $ execute -f prompt.md -m metadata.yml -i

Example Workflow:
  1. Inspect the prompt:
    $ execute -f ./prompts/universal_translator/prompt.md -m ./prompts/universal_translator/metadata.yml -i

  2. Execute the prompt with mixed inputs:
    $ execute -f ./prompts/universal_translator/prompt.md -m ./prompts/universal_translator/metadata.yml \\
    --source_language_or_mode english \\
    --target_language_or_mode french \\
    -fi communication=./input.txt

Note:
  - File paths are relative to the current working directory.
  - Use quotes for values containing spaces.
`
            )
            .action(this.execute.bind(this));
    }

    private collect(value: string, previous: Record<string, string>): Record<string, string> {
        const [variable, file] = value.split('=');
        return { ...previous, [variable]: file };
    }

    private parseDynamicOptions(args: string[]): Record<string, string> {
        const options: Record<string, string> = {};

        for (let i = 0; i < args.length; i += 2) {
            if (args[i].startsWith('--')) {
                const key = args[i].slice(2).replace(/-/g, '_');
                options[key] = args[i + 1];
            }
        }
        return options;
    }

    async execute(options: any, command: any): Promise<void> {
        try {
            if (options.help) {
                this.outputHelp();
                return;
            }

            const dynamicOptions = this.parseDynamicOptions(command.args);

            if (options.prompt) {
                await this.handleStoredPrompt(options.prompt, dynamicOptions, options.inspect, options.fileInput);
            } else if (options.promptFile && options.metadataFile) {
                await this.handleFilePrompt(
                    options.promptFile,
                    options.metadataFile,
                    dynamicOptions,
                    options.inspect,
                    options.fileInput
                );
            } else {
                console.error(
                    chalk.red('Error: You must provide either a prompt ID or both prompt file and metadata file paths.')
                );
                this.outputHelp();
            }
        } catch (error) {
            this.handleError(error, 'execute command');
        }
    }

    private async handleStoredPrompt(
        promptId: string,
        dynamicOptions: Record<string, string>,
        inspect: boolean,
        fileInputs: Record<string, string>
    ): Promise<void> {
        try {
            const promptFiles = await this.handleApiResult(await getPromptFiles(promptId), 'Fetched prompt files');

            if (!promptFiles) return;

            const { promptContent, metadata } = promptFiles;

            if (inspect) {
                await this.inspectPrompt(metadata);
            } else {
                await this.executePromptWithMetadata(promptContent, metadata, dynamicOptions, fileInputs);
            }
        } catch (error) {
            this.handleError(error, 'handling stored prompt');
        }
    }

    private async handleFilePrompt(
        promptFile: string,
        metadataFile: string,
        dynamicOptions: Record<string, string>,
        inspect: boolean,
        fileInputs: Record<string, string>
    ): Promise<void> {
        try {
            const promptContent = await fs.readFile(promptFile, 'utf-8');
            const metadataContent = await fs.readFile(metadataFile, 'utf-8');
            const metadata = yaml.load(metadataContent) as Metadata;

            if (inspect) {
                await this.inspectPrompt(metadata);
            } else {
                await this.executePromptWithMetadata(promptContent, metadata, dynamicOptions, fileInputs);
            }
        } catch (error) {
            this.handleError(error, 'handling file prompt');
        }
    }

    private async inspectPrompt(metadata: Metadata): Promise<void> {
        try {
            await viewPromptDetails(
                {
                    id: '',
                    title: metadata.title,
                    primary_category: metadata.primary_category,
                    description: metadata.description,
                    tags: metadata.tags,
                    variables: metadata.variables
                } as Prompt & { variables: Variable[] },
                true
            );
        } catch (error) {
            this.handleError(error, 'inspecting prompt');
        }
    }

    private async executePromptWithMetadata(
        promptContent: string,
        metadata: Metadata,
        dynamicOptions: Record<string, string>,
        fileInputs: Record<string, string>
    ): Promise<void> {
        try {
            const userInputs: Record<string, string> = {};

            for (const variable of metadata.variables) {
                const snakeCaseName = variable.name.replace(/[{}]/g, '').toLowerCase();
                let value = dynamicOptions[snakeCaseName];

                if (fileInputs[snakeCaseName]) {
                    try {
                        value = await fs.readFile(fileInputs[snakeCaseName], 'utf-8');
                        console.log(chalk.green(`Loaded file content for ${snakeCaseName}`));
                    } catch (error) {
                        console.error(chalk.red(`Error reading file for ${snakeCaseName}:`, error));
                    }
                }

                if (value) {
                    userInputs[variable.name] = value;
                } else if (!variable.optional_for_user) {
                    throw new Error(`Required variable ${snakeCaseName} is not set.`);
                }
            }

            const updatedPromptContent = updatePromptWithVariables(promptContent, userInputs);
            const result = await processPromptContent([{ role: 'user', content: updatedPromptContent }], false, false);

            if (typeof result === 'string') {
                console.log(result);
            } else {
                console.error(chalk.red('Unexpected result format from prompt processing'));
            }
        } catch (error) {
            this.handleError(error, 'executing prompt with metadata');
        }
    }
}

export default new ExecuteCommand();
