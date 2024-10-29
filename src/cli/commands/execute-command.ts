import chalk from 'chalk';
import { Command } from 'commander';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';
import * as O from 'fp-ts/lib/Option';
import * as E from 'fp-ts/lib/Either';
import * as A from 'fp-ts/lib/Array';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

import {
    CommandContext,
    CommandError,
    CommandResult,
    createCommand,
    createCommandError,
    fromApiResult,
    taskEitherFromPromise
} from './base-command';
import { ConversationManager } from '../utils/conversation-manager';
import { getPromptFiles, viewPromptDetails } from '../utils/prompts';
import { resolveInputs } from '../utils/input-resolver';
import { PromptMetadata, PromptVariable } from '../../shared/types';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt-processing';
import { formatSnakeCase } from '../../shared/utils/string-formatter';

interface ExecuteCommandResult extends CommandResult {
    readonly action?: 'execute' | 'back';
}

interface ExecuteOptions {
    readonly prompt?: string;
    readonly promptFile?: string;
    readonly metadataFile?: string;
    readonly inspect?: boolean;
    readonly fileInput?: Record<string, string>;
    readonly [key: string]: unknown;
}

interface PromptData {
    readonly promptContent: string;
    readonly metadata: PromptMetadata;
}

const executePromptWithMetadata = async (
    promptContent: string,
    metadata: PromptMetadata,
    dynamicOptions: Record<string, string>,
    fileInputs: Record<string, string>
): Promise<string> => {
    const userInputs: Record<string, string> = {};

    // First, validate all required variables
    const missingVariables: string[] = [];

    for (const variable of metadata.variables) {
        const variableName = variable.name.replace(/[{}]/g, '');
        const snakeCaseName = variableName.toLowerCase();

        // Skip if variable has a default value
        if (variable.value) {
            userInputs[variable.name] = variable.value;
            continue;
        }

        // Check if variable is required and not set
        if (!variable.optional_for_user) {
            const hasValue =
                (dynamicOptions && snakeCaseName in dynamicOptions) || (fileInputs && snakeCaseName in fileInputs);

            if (!hasValue) {
                missingVariables.push(snakeCaseName);
            }
        }
    }

    // If any required variables are missing, throw an error
    if (missingVariables.length > 0) {
        throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
    }

    // Process all variables
    for (const variable of metadata.variables) {
        const variableName = variable.name.replace(/[{}]/g, '');
        const snakeCaseName = variableName.toLowerCase();

        // Skip if already set from default value
        if (variable.name in userInputs) {
            continue;
        }

        let value = dynamicOptions[snakeCaseName];

        if (fileInputs[snakeCaseName]) {
            try {
                value = await fs.readFile(fileInputs[snakeCaseName], 'utf-8');
                // console.log(chalk.green(`Loaded file content for ${snakeCaseName}`));
            } catch (error) {
                console.error(chalk.red(`Error reading file for ${snakeCaseName}:`, error));
                throw new Error(`Failed to read file for ${snakeCaseName}`);
            }
        }

        if (value !== undefined) {
            userInputs[variable.name] = value;
        } else if (!variable.optional_for_user) {
            // This should never happen due to previous validation, but keep as safety
            throw new Error(`Required variable ${snakeCaseName} is not set`);
        }
    }

    // Log the variables being used (helpful for debugging)
    // console.log(chalk.cyan('\nUsing variables:'));
    // Object.entries(userInputs).forEach(([key, value]) => {
    //     console.log(`  ${formatSnakeCase(key)}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
    // });

    const updatedPromptContent = updatePromptWithVariables(promptContent, userInputs);
    const result = await processPromptContent([{ role: 'user', content: updatedPromptContent }], false, false);

    if (typeof result !== 'string') {
        throw new Error('Unexpected result format from prompt processing');
    }

    console.log(result);

    return result;
};

const inspectVariables = (metadata: PromptMetadata): void => {
    console.log(chalk.cyan('\nRequired variables:'));
    metadata.variables
        .filter((v) => !v.optional_for_user && !v.value)
        .forEach((v) => {
            const name = v.name.replace(/[{}]/g, '').toLowerCase();
            console.log(chalk.red(`  ${name}`));
        });

    console.log(chalk.cyan('\nOptional variables:'));
    metadata.variables
        .filter((v) => v.optional_for_user || v.value)
        .forEach((v) => {
            const name = v.name.replace(/[{}]/g, '').toLowerCase();
            if (!v.value) {
                //console.log(chalk.green(`  ${name} (default: ${v.value})`));
                //} else {
                console.log(chalk.yellow(`  ${name}`));
            }
        });
};

const inspectPrompt = async (metadata: PromptMetadata): Promise<void> => {
    await viewPromptDetails(
        {
            id: '',
            title: metadata.title,
            primary_category: metadata.primary_category,
            description: metadata.description,
            tags: metadata.tags,
            variables: metadata.variables
        } as PromptMetadata,
        true
    );
};

const parseDynamicOptions = (options: ExecuteOptions): Record<string, string> => {
    const excludedKeys = ['prompt', 'promptFile', 'metadataFile', 'inspect', 'fileInput'];
    return Object.entries(options).reduce(
        (acc, [key, value]) => {
            if (!excludedKeys.includes(key) && typeof value === 'string') {
                acc[key.replace(/-/g, '_')] = value;
            }
            return acc;
        },
        {} as Record<string, string>
    );
};

const executeExecuteCommand = (ctx: CommandContext): TE.TaskEither<CommandError, ExecuteCommandResult> => {
    // Extract options from Commander's parsed object
    const options: ExecuteOptions = {
        prompt: ctx.options.prompt as string | undefined,
        promptFile: ctx.options.promptFile as string | undefined,
        metadataFile: ctx.options.metadataFile as string | undefined,
        inspect: Boolean(ctx.options.inspect),
        fileInput: (ctx.options.fileInput as Record<string, string>) || {},
        ...Object.fromEntries(
            Object.entries(ctx.options)
                .filter(([key]) => !['prompt', 'promptFile', 'metadataFile', 'inspect', 'fileInput'].includes(key))
                .map(([key, value]) => [key, String(value)])
        )
    };

    const dynamicOptions = parseDynamicOptions(options);
    const fileInputs = options.fileInput || {};

    // Modified validation to properly check for prompt ID
    if (!options.prompt && (!options.promptFile || !options.metadataFile)) {
        if (options.prompt === undefined && (!options.promptFile || !options.metadataFile)) {
            return TE.left(
                createCommandError(
                    'INVALID_INPUT',
                    'Must provide either prompt ID (-p) or both prompt file (-f) and metadata file (-m)'
                )
            );
        }
    }

    return pipe(
        TE.Do,
        TE.bind('promptData', () =>
            options.prompt
                ? fromApiResult(getPromptFiles(options.prompt, { cleanVariables: true }))
                : pipe(
                      TE.Do,
                      TE.bind('promptContent', () =>
                          taskEitherFromPromise(
                              () => fs.readFile(options.promptFile!, 'utf-8'),
                              (error) => createCommandError('FILE_READ_ERROR', `Failed to read prompt file: ${error}`)
                          )
                      ),
                      TE.bind('metadata', () =>
                          taskEitherFromPromise(
                              async () => {
                                  const content = await fs.readFile(options.metadataFile!, 'utf-8');
                                  return yaml.load(content) as PromptMetadata;
                              },
                              (error) => createCommandError('FILE_READ_ERROR', `Failed to read metadata file: ${error}`)
                          )
                      ),
                      TE.map(({ promptContent, metadata }) => ({ promptContent, metadata }))
                  )
        ),
        TE.chain(({ promptData }) => {
            // Always show variable requirements before execution
            // if (!options.inspect) {
            //     inspectVariables(promptData.metadata);
            // }

            return options.inspect
                ? pipe(
                      taskEitherFromPromise(
                          () => inspectPrompt(promptData.metadata),
                          (error) => createCommandError('INSPECT_ERROR', `Failed to inspect prompt: ${error}`)
                      ),
                      TE.map(() => ({ completed: true, action: 'execute' as const }))
                  )
                : pipe(
                      taskEitherFromPromise(
                          () =>
                              executePromptWithMetadata(
                                  promptData.promptContent,
                                  promptData.metadata,
                                  dynamicOptions,
                                  fileInputs
                              ),
                          (error) => createCommandError('EXECUTION_ERROR', `Failed to execute prompt: ${error}`)
                      ),
                      TE.map(() => ({ completed: true, action: 'execute' as const }))
                  );
        })
    );
};

export const executeCommand = pipe(
    createCommand('execute', 'Execute or inspect a prompt', executeExecuteCommand),
    (command) =>
        command
            .option('-p, --prompt <id>', 'Execute a stored prompt by ID')
            .option('-f, --prompt-file <file>', 'Path to the prompt file')
            .option('-m, --metadata-file <file>', 'Path to the metadata file')
            .option('-i, --inspect', 'Inspect the prompt variables without executing')
            .option(
                '-fi, --file-input <variable>=<file>',
                'Specify a file to use as input for a variable',
                (value, previous: Record<string, string>) => {
                    const [variable, file] = value.split('=');
                    if (!variable || !file) {
                        throw new Error('File input must be in format: variable=filepath');
                    }
                    return { ...previous, [variable.trim()]: file.trim() };
                },
                {}
            )
            .allowUnknownOption(true)
            .passThroughOptions(false)
            .action(async (cmdOptions, cmd) => {
                try {
                    const options = {
                        ...cmdOptions,
                        ...Object.fromEntries(
                            cmd.args
                                .filter((arg: string) => arg.startsWith('--'))
                                .map((arg: string) => [
                                    arg.slice(2).replace(/-/g, '_'),
                                    cmd.args[cmd.args.indexOf(arg) + 1]
                                ])
                        )
                    };

                    const result = await executeExecuteCommand({
                        args: [],
                        options
                    })();

                    if (E.isLeft(result)) {
                        throw new Error(result.left.message);
                    }
                } catch (error) {
                    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
                    process.exit(1);
                }
            })
            .addHelpText(
                'after',
                `
Dynamic Options:
  This command allows setting prompt variables dynamically using additional options.
  Variables can be set either by value or by file content.

Setting variables by value:
  Use --variable_name "value" format for each variable.

  Example:
  $ execute -p 59 --source_language english --target_language french
  $ execute -f prompt.md -m metadata.yml --source_language english --target_language french

Setting variables by file content:
  Use -fi or --file-input option with variable=filepath format.

  Example:
  $ execute -p 59 -fi communication=input.txt
  $ execute -f prompt.md -m metadata.yml -fi communication=input.txt

Combining value and file inputs:
  You can mix both methods in a single command.

  Example:
  $ execute -p 59 --source_language english -fi communication=input.txt
  $ execute -f prompt.md -m metadata.yml --source_language english -fi communication=input.txt

Common Variables:
  While variables are prompt-specific, some common ones include:
  --safety_guidelines <value>             Set safety rules or ethical considerations
  --output_format <value>                 Set the structure and components of the final output
  --extra_guidelines_or_context <value>   Set additional information or instructions

Inspecting Variables:
  Use -i or --inspect to see all available variables for a specific prompt:
  $ execute -p 59 -i
  $ execute -f prompt.md -m metadata.yml -i

Note:
  - File paths are relative to the current working directory
  - Use quotes for values containing spaces
  - When using prompt ID (-p), the ID must exist in the database
  - When using files (-f, -m), both prompt and metadata files must exist
`
            )
);
