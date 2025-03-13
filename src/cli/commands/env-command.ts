import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { EnvVariable, PromptFragment, ApiResult } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { FRAGMENT_PREFIX } from '../constants';
import { createEnvVar, readEnvVars, updateEnvVar, deleteEnvVar, getEnvVarByName } from '../utils/env-vars';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { listPrompts, getPromptFiles } from '../utils/prompts';
import { formatMenuItem, printSectionHeader } from '../utils/ui-components';

class EnvCommand extends BaseCommand {
    constructor() {
        super('env', 'Manage global environment variables');
        
        this.option('--list', 'List all environment variables')
            .option('--set <key=value>', 'Set an environment variable')
            .option('--fragment <key=category/name>', 'Set an environment variable to a fragment reference')
            .option('--unset <key>', 'Unset (clear) an environment variable')
            .option('--create <key=value>', 'Create a new environment variable')
            .option('--info <key>', 'Show detailed information about an environment variable')
            .option('--view <key>', 'View the value of an environment variable')
            .option('--sources <key>', 'Show all prompt sources for a variable')
            .option('--show-titles', 'Show prompt titles instead of IDs in sources')
            .option('--json', 'Output results in JSON format');
            
        this.action(this.execute.bind(this));
    }

    async execute(options: any): Promise<void> {
        try {
            // Load all variables and current environment variables
            const allVariables = await this.getAllUniqueVariables();
            const envVarsResult = await readEnvVars();
            const envVarsData = this.handleApiResultSync(envVarsResult, 'Fetched environment variables');
            
            if (!envVarsData) return;
            
            const envVars: EnvVariable[] = envVarsData;
            
            // Handle CLI arguments if provided
            if (options.list) {
                await this.listEnvironmentVariables(allVariables, envVars);
                return;
            }
            
            if (options.set) {
                const [key, value] = options.set.split('=');
                if (!key || value === undefined) {
                    console.error(chalk.red('Error: Invalid format. Use --set key=value'));
                    return;
                }
                await this.setVariable(key.trim(), value, envVars);
                return;
            }
            
            if (options.fragment) {
                const [key, fragmentPath] = options.fragment.split('=');
                if (!key || !fragmentPath) {
                    console.error(chalk.red('Error: Invalid format. Use --fragment key=category/name'));
                    return;
                }
                await this.setFragmentVariable(key.trim(), fragmentPath.trim(), envVars);
                return;
            }
            
            if (options.unset) {
                await this.unsetVariableByName(options.unset.trim(), envVars);
                return;
            }
            
            if (options.create) {
                const [key, value] = options.create.split('=');
                if (!key || value === undefined) {
                    console.error(chalk.red('Error: Invalid format. Use --create key=value'));
                    return;
                }
                await this.createNewVariable(key.trim(), value, envVars);
                return;
            }
            
            if (options.info) {
                await this.showVariableInfo(options.info.trim(), allVariables, envVars);
                return;
            }
            
            if (options.view) {
                await this.viewVariableValue(options.view.trim(), envVars);
                return;
            }
            
            if (options.sources) {
                await this.showVariableSources(options.sources.trim(), allVariables, options.showTitles);
                return;
            }
            
            // If no options provided, launch interactive mode
            await this.interactiveMode(allVariables, envVars);
        } catch (error) {
            this.handleError(error, 'env command');
        }
    }
    
    private async interactiveMode(
        allVariables: Array<{ name: string; role: string; promptIds?: string[] }>,
        envVars: EnvVariable[]
    ): Promise<void> {
        while (true) {
            try {
                console.clear();
                printSectionHeader('Environment Variables', '🌱');
                
                // Format table data
                const variablesWithPromptIds = allVariables.map(v => ({
                    ...v, 
                    promptIds: v.promptIds || []
                }));
                const { headers, rows, separator, variablesMap } = this.formatEnvironmentVariablesTable(variablesWithPromptIds, envVars);
                
                // Create menu choices that look like a table
                const tableChoices: Array<{ name: string; value: { name: string; role: string; promptIds: string[] } | 'back' | 'refresh'; disabled?: boolean }> = [];
                
                // Add a header row
                tableChoices.push({
                    name: headers,
                    value: 'back',
                    disabled: true
                });
                
                // Add a separator
                tableChoices.push({
                    name: separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add each row as a selectable item
                rows.forEach((row, index) => {
                    tableChoices.push({
                        name: row,
                        value: variablesMap[index]
                    });
                });
                
                // Add a separator at the bottom
                tableChoices.push({
                    name: separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add action buttons
                tableChoices.push({
                    name: formatMenuItem('Create new variable', 'create', 'primary').name,
                    value: { name: '__create', role: '', promptIds: [] }
                });
                
                // Add info
                tableChoices.push({
                    name: chalk.italic(`Found ${allVariables.length} variables (${envVars.length} set).`),
                    value: 'back',
                    disabled: true
                });

                const action = await this.showMenu<{ name: string; role: string } | 'back' | 'refresh'>(
                    'Use ↑↓ to select an environment variable:',
                    tableChoices,
                    {
                        clearConsole: false,
                    }
                );

                if (action === 'back') return;
                
                // Keep refresh handling for backward compatibility
                if (action === 'refresh') {
                    // Reload data
                    const refreshedEnvVarsResult = await readEnvVars();
                    const refreshedEnvVarsData = this.handleApiResultSync(refreshedEnvVarsResult, 'Refreshed environment variables');
                    if (refreshedEnvVarsData) {
                        envVars = refreshedEnvVarsData as EnvVariable[];
                    }
                    // Also reload all variables to ensure custom variables are included
                    allVariables = await this.getAllUniqueVariables();
                    continue;
                }
                
                if (action.name === '__create') {
                    await this.createNewVariableInteractive(envVars);
                    // Reload env vars after creation
                    const refreshResult = await readEnvVars();
                    const refreshedEnvVarsData = this.handleApiResultSync(refreshResult, 'Refreshed environment variables');
                    if (refreshedEnvVarsData) {
                        envVars = refreshedEnvVarsData as EnvVariable[];
                    }
                    // Also need to reload all variables to include the new custom variable
                    allVariables = await this.getAllUniqueVariables();
                    continue;
                }

                if (typeof action !== 'string') {
                    // Ensure it has the promptIds property
                    const actionWithPromptIds = {
                        ...action,
                        promptIds: []
                    };
                    await this.manageEnvVar(actionWithPromptIds, envVars);
                }
                
                // Reload env vars after management
                const updatedEnvVarsResult = await readEnvVars();
                const updatedEnvVarsData = this.handleApiResultSync(updatedEnvVarsResult, 'Updated environment variables');
                if (updatedEnvVarsData) {
                    envVars = updatedEnvVarsData as EnvVariable[];
                }
                // Also reload all variables to ensure custom variables are included
                allVariables = await this.getAllUniqueVariables();
            } catch (error) {
                this.handleError(error, 'env command');
                await this.pressKeyToContinue();
            }
        }
    }

    private formatEnvironmentVariablesTable(
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        envVars: EnvVariable[]
    ): {
        headers: string;
        rows: string[];
        separator: string;
        variablesMap: Array<{ name: string; role: string; promptIds: string[] }>;
    } {
        // Calculate max lengths for columns
        const maxNameLength = Math.max(...allVariables.map((v) => formatSnakeCase(v.name).length), 15);
        
        // Format prompt IDs into a source column
        const formatSourceColumn = (promptIds: string[]) => {
            if (promptIds.length === 0) return 'Custom';
            if (promptIds.length < 5) {
                // For 1-4 prompts, just show IDs
                return promptIds.join(', ');
            } else {
                // For 5+ prompts, show count
                return `${promptIds.length} prompts`;
            }
        };
        
        const sources = allVariables.map(v => formatSourceColumn(v.promptIds));
        const maxSourceLength = Math.max(...sources.map(s => s.length), 15);
        
        const tableWidth = maxNameLength + maxSourceLength + 40; // Additional space for status
        
        // Create headers
        const headers = `${chalk.bold('Variable'.padEnd(maxNameLength + 2))}${chalk.bold('Source'.padEnd(maxSourceLength + 2))}${chalk.bold('Status')}`;
        
        // Create a separator
        const separator = '─'.repeat(tableWidth);
        
        // Create rows
        const rows: string[] = [];
        const variablesMap: Array<{ name: string; role: string; promptIds: string[] }> = [];
        
        allVariables.forEach((variable, index) => {
            const formattedName = formatSnakeCase(variable.name);
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formattedName);
            const status = this.getVariableStatus(envVar);
            const source = sources[index];
            
            rows.push(
                `${chalk.cyan(formattedName.padEnd(maxNameLength + 2))}${chalk.yellow(source.padEnd(maxSourceLength + 2))}${status}`
            );
            variablesMap.push(variable);
        });
        
        return {
            headers,
            rows,
            separator,
            variablesMap
        };
    }
    
    private formatVariableChoices(
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        envVars: EnvVariable[]
    ): Array<{ name: string; value: { name: string; role: string; promptIds: string[] } }> {
        const maxNameLength = Math.max(...allVariables.map((v) => formatSnakeCase(v.name).length));
        return allVariables.map((variable) => {
            const formattedName = formatSnakeCase(variable.name);
            const paddedName = formattedName.padEnd(maxNameLength);
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formattedName);
            const status = this.getVariableStatus(envVar);
            return {
                name: `${paddedName} --> ${status}`,
                value: variable
            };
        });
    }

    private getVariableStatus(envVar: EnvVariable | undefined): string {
        if (!envVar) return chalk.yellow('Not Set');

        const trimmedValue = envVar.value.trim();
        
        // Handle empty values
        if (trimmedValue === '') {
            return chalk.yellow('Not Set');
        }

        if (trimmedValue.startsWith(FRAGMENT_PREFIX)) {
            return chalk.blue(trimmedValue);
        }

        const isSensitive =
            envVar.name.includes('API_KEY') ||
            envVar.name.includes('SECRET') ||
            envVar.name.includes('TOKEN') ||
            /key/i.test(envVar.name);
        return chalk.green(
            isSensitive
                ? 'Set: ********'
                : `Set: ${trimmedValue.substring(0, 20)}${trimmedValue.length > 20 ? '...' : ''}`
        );
    }

    private async manageEnvVar(variable: { name: string; role: string; promptIds: string[] }, envVars: EnvVariable[]): Promise<void> {
        const envVar = envVars.find((v) => v.name === variable.name);
        
        // Determine if variable is inferred or custom
        const isInferred = variable.promptIds && variable.promptIds.length > 0;
        
        // Check if variable is already empty
        const isEmpty = !envVar || (envVar && (!envVar.value || envVar.value.trim() === ''));
        
        // Menu options with conditional Unset option
        const menuOptions: Array<{ name: string; value: 'enter' | 'fragment' | 'unset' | 'info' }> = [
            { name: 'Enter value', value: 'enter' },
            { name: 'Use fragment', value: 'fragment' },
            { name: 'View details', value: 'info' }
        ];
        
        // Only show unset option if variable has a value
        if (!isEmpty) {
            menuOptions.push({
                name: isInferred ? chalk.yellow('Unset (cannot delete inferred variable)') : chalk.red('Unset/Delete'),
                value: 'unset'
            });
        }
        
        console.clear();
        printSectionHeader('Edit Environment Variable', '♻️');

        const action = await this.showMenu<'enter' | 'fragment' | 'unset' | 'info' | 'back'>(
            `Use ↑↓ to select an action for ${formatSnakeCase(variable.name)}:`,
            menuOptions,
            {
                clearConsole: false
            }
        );
        switch (action) {
            case 'enter':
                await this.enterValueForVariable(variable, envVar);
                break;
            case 'fragment':
                await this.assignFragmentToVariable(variable);
                break;
            case 'info':
                await this.showVariableInfoInteractive(variable, envVar);
                await this.pressKeyToContinue();
                break;
            case 'unset':
                await this.unsetVariable(variable, envVar);
                break;
            case 'back':
                return;
        }
    }
    
    private handleApiResultSync<T>(result: ApiResult<T>, successMessage?: string): T | null {
        if (!result.success || !result.data) {
            console.error(chalk.red(result.error || 'API request failed'));
            return null;
        }

        if (successMessage) {
            console.debug(chalk.green(`✓ ${successMessage}`));
        }

        return result.data;
    }
    
    private async listEnvironmentVariables(
        allVariables: Array<{ name: string; role: string; promptIds?: string[] }>,
        envVars: EnvVariable[]
    ): Promise<void> {
        const variablesWithPromptIds = allVariables.map(v => ({
            ...v, 
            promptIds: v.promptIds || []
        }));
        
        // Check if JSON output is requested
        if (process.argv.includes('--json')) {
            // Format data for JSON output
            const result = variablesWithPromptIds.map(variable => {
                const formattedName = formatSnakeCase(variable.name);
                const envVar = envVars.find((v) => formatSnakeCase(v.name) === formattedName);
                
                return {
                    name: formattedName,
                    description: variable.role || '',
                    inferred: variable.promptIds.length > 0,
                    prompt_sources: variable.promptIds,
                    value: envVar ? envVar.value : null,
                    is_fragment: envVar ? envVar.value.startsWith(FRAGMENT_PREFIX) : false,
                    is_set: !!envVar
                };
            });
            
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        
        // Standard table output
        const { headers, rows, separator } = this.formatEnvironmentVariablesTable(variablesWithPromptIds, envVars);
        
        console.log(headers);
        console.log(separator);
        rows.forEach(row => console.log(row));
        console.log(separator);
        console.log(chalk.italic(`Found ${allVariables.length} variables (${envVars.length} set).`));
    }
    
    private async setVariable(key: string, value: string, envVars: EnvVariable[]): Promise<void> {
        try {
            // Find the variable in environment variables
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formatSnakeCase(key));
            
            if (envVar) {
                // Update existing variable
                const updateResult = await updateEnvVar(envVar.id, value);
                if (updateResult.success) {
                    console.log(chalk.green(`Updated variable ${formatSnakeCase(key)}`));
                } else {
                    console.error(chalk.red(`Failed to update ${formatSnakeCase(key)}: ${updateResult.error}`));
                }
            } else {
                // Create new variable
                const createResult = await createEnvVar({ 
                    name: key, 
                    value,
                    scope: 'global'
                });
                
                if (createResult.success) {
                    console.log(chalk.green(`Created variable ${formatSnakeCase(key)}`));
                } else {
                    console.error(chalk.red(`Failed to create ${formatSnakeCase(key)}: ${createResult.error}`));
                }
            }
        } catch (error) {
            this.handleError(error, 'setting variable value');
        }
    }
    
    private async setFragmentVariable(key: string, fragmentPath: string, envVars: EnvVariable[]): Promise<void> {
        try {
            // Parse fragment path
            const [category, name] = fragmentPath.split('/');
            if (!category || !name) {
                console.error(chalk.red('Invalid fragment path format. Use category/name'));
                return;
            }
            
            // Validate that fragment exists
            const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');
            if (!fragments) return;
            
            const fragment = fragments.find(f => f.category === category && f.name === name);
            if (!fragment) {
                console.error(chalk.red(`Fragment "${category}/${name}" not found`));
                return;
            }
            
            // Create fragment reference
            const fragmentRef = `${FRAGMENT_PREFIX}${category}/${name}`;
            
            // Find if variable exists
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formatSnakeCase(key));
            
            if (envVar) {
                // Update existing variable
                const updateResult = await updateEnvVar(envVar.id, fragmentRef);
                if (updateResult.success) {
                    console.log(chalk.green(`Updated variable ${formatSnakeCase(key)} with fragment reference`));
                } else {
                    console.error(chalk.red(`Failed to update ${formatSnakeCase(key)}: ${updateResult.error}`));
                }
            } else {
                // Create new variable
                const createResult = await createEnvVar({ 
                    name: key, 
                    value: fragmentRef,
                    scope: 'global'
                });
                
                if (createResult.success) {
                    console.log(chalk.green(`Created variable ${formatSnakeCase(key)} with fragment reference`));
                } else {
                    console.error(chalk.red(`Failed to create ${formatSnakeCase(key)}: ${createResult.error}`));
                }
            }
            
            // Show preview of fragment content
            const fragmentContent = await this.handleApiResult(
                await viewFragmentContent(category, name),
                `Fetched content for fragment ${fragmentRef}`
            );
            
            if (fragmentContent) {
                console.log(chalk.cyan('\nFragment content preview:'));
                console.log(fragmentContent.substring(0, 200) + (fragmentContent.length > 200 ? '...' : ''));
            }
        } catch (error) {
            this.handleError(error, 'setting fragment variable');
        }
    }
    
    private async unsetVariableByName(key: string, envVars: EnvVariable[]): Promise<void> {
        try {
            // Find if variable exists
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formatSnakeCase(key));
            
            if (envVar) {
                // Check if this variable is inferred from prompts
                const allVariables = await this.getAllUniqueVariables();
                const variable = allVariables.find(v => formatSnakeCase(v.name) === formatSnakeCase(key));
                const isInferred = variable && variable.promptIds && variable.promptIds.length > 0;
                
                if (isInferred) {
                    // For inferred variables, we should only unset the value, not delete it
                    const updateResult = await updateEnvVar(envVar.id, '');
                    if (updateResult.success) {
                        console.log(chalk.green(`Unset value for ${formatSnakeCase(key)} (inferred variable)`));
                        // Force reload env vars after update
                        await readEnvVars();
                    } else {
                        console.error(chalk.red(`Failed to unset ${formatSnakeCase(key)}: ${updateResult.error}`));
                    }
                } else {
                    // For custom variables, we can delete them
                    const deleteResult = await deleteEnvVar(envVar.id);
                    if (deleteResult.success) {
                        console.log(chalk.green(`Deleted variable ${formatSnakeCase(key)}`));
                        // Force reload env vars after deletion
                        await readEnvVars();
                    } else {
                        console.error(chalk.red(`Failed to delete ${formatSnakeCase(key)}: ${deleteResult.error}`));
                    }
                }
            } else {
                console.log(chalk.yellow(`Variable ${formatSnakeCase(key)} is not set`));
            }
        } catch (error) {
            this.handleError(error, 'unsetting variable');
        }
    }
    
    private async createNewVariable(key: string, value: string, envVars: EnvVariable[]): Promise<void> {
        try {
            // Format and normalize the variable name
            const formattedName = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            
            // First check directly in the database
            const existingVarResult = await getEnvVarByName(formattedName);
            
            if (!existingVarResult.success) {
                console.error(chalk.red(`Error checking for existing variable: ${existingVarResult.error}`));
                
                // Handle JSON output
                if (process.argv.includes('--json')) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Error checking for existing variable: ${existingVarResult.error}`,
                        variable: formattedName
                    }, null, 2));
                }
                return;
            }
            
            if (existingVarResult.data) {
                console.log(chalk.yellow(`Variable "${formattedName}" already exists.`));
                
                // If --json is specified, return JSON error
                if (process.argv.includes('--json')) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Variable "${formattedName}" already exists. Use --set to update it.`,
                        variable: formattedName,
                        current_value: existingVarResult.data.value.substring(0, 50) + 
                            (existingVarResult.data.value.length > 50 ? '...' : '')
                    }, null, 2));
                    return;
                }
                
                console.log(chalk.yellow(`Use --set ${formattedName}="${value}" to update it.`));
                return;
            }
            
            // Also check in the current list (might have just been added this session)
            const envVar = envVars.find((v) => formatSnakeCase(v.name) === formatSnakeCase(formattedName));
            
            if (envVar) {
                console.log(chalk.yellow(`Variable "${formattedName}" already exists in the current session.`));
                
                // If --json is specified, return JSON error
                if (process.argv.includes('--json')) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Variable "${formattedName}" already exists. Use --set to update it.`,
                        variable: formattedName
                    }, null, 2));
                    return;
                }
                
                console.log(chalk.yellow(`Use --set ${formattedName}="${value}" to update it.`));
                return;
            }
            
            // Create new variable with better feedback
            console.log(chalk.cyan(`Creating variable ${formattedName}...`));
            
            const createResult = await createEnvVar({ 
                name: formattedName, 
                value,
                scope: 'global'
            });
            
            // Handle JSON output if specified
            if (process.argv.includes('--json')) {
                if (createResult.success) {
                    console.log(JSON.stringify({
                        success: true,
                        message: `Created variable ${formattedName}`,
                        variable: {
                            name: formattedName,
                            value: value.length > 100 ? value.substring(0, 100) + '...' : value,
                            id: createResult.data?.id
                        }
                    }, null, 2));
                } else {
                    console.log(JSON.stringify({
                        success: false,
                        error: createResult.error,
                        variable: formattedName
                    }, null, 2));
                }
                return;
            }
            
            // Standard output
            if (createResult.success) {
                console.log(chalk.green(`✓ Successfully created variable ${formatSnakeCase(formattedName)}`));
                
                if (createResult.data) {
                    // Display basic variable info
                    console.log(`  ID: ${createResult.data.id}`);
                    console.log(`  Value: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
                }
                
                // Hint that the variable will now be visible in the list
                console.log(chalk.cyan(`To see all variables including this one, run: env --list`));
            } else {
                console.error(chalk.red(`✗ Failed to create ${formatSnakeCase(formattedName)}: ${createResult.error}`));
            }
        } catch (error) {
            this.handleError(error, 'creating variable');
            
            // Provide more helpful error information
            if (error instanceof Error) {
                console.error(chalk.red(`Error details: ${error.message}`));
            }
        }
    }
    
    private async createNewVariableInteractive(envVars: EnvVariable[]): Promise<void> {
        try {
            console.log(chalk.cyan('\nCreate a New Environment Variable'));
            console.log(chalk.gray('─'.repeat(60)));
            
            const name = await this.getInput('Enter variable name (use UPPERCASE_SNAKE_CASE):');
            if (!name) {
                console.log(chalk.yellow('Variable creation cancelled.'));
                return;
            }
            
            // Format and normalize the variable name
            const formattedName = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            
            // Check directly in the database for this variable
            console.log(chalk.gray('Checking if variable already exists...'));
            const existingVarResult = await getEnvVarByName(formattedName);
            
            if (!existingVarResult.success) {
                console.error(chalk.red(`Error checking for existing variable: ${existingVarResult.error}`));
                return;
            }
            
            // If the variable exists in the database
            if (existingVarResult.data) {
                console.log(chalk.yellow(`Variable "${formattedName}" already exists. You can update it instead.`));
                console.log(chalk.gray(`Current value: ${existingVarResult.data.value.substring(0, 30)}${existingVarResult.data.value.length > 30 ? '...' : ''}`));
                
                // Ask if user wants to update instead
                const shouldUpdate = await this.confirmAction(
                    `Do you want to update the existing variable "${formattedName}"?`
                );
                
                if (!shouldUpdate) {
                    console.log(chalk.yellow('Variable creation cancelled.'));
                    return;
                }
            } 
            // Also check in the current list (might have just been added)
            else {
                const envVar = envVars.find((v) => formatSnakeCase(v.name) === formatSnakeCase(formattedName));
                
                if (envVar) {
                    console.log(chalk.yellow(`Variable "${formattedName}" exists in the current session. You can update it instead.`));
                    
                    // Ask if user wants to update instead
                    const shouldUpdate = await this.confirmAction(
                        `Do you want to update the existing variable "${formattedName}"?`
                    );
                    
                    if (!shouldUpdate) {
                        console.log(chalk.yellow('Variable creation cancelled.'));
                        return;
                    }
                }
            }
            
            const valueType = await this.showMenu<'text' | 'fragment' | 'back'>('Choose value type:', [
                { name: 'Enter text value', value: 'text' },
                { name: 'Use fragment reference', value: 'fragment' }
            ]);
            
            if (valueType === 'back') {
                console.log(chalk.yellow('Variable creation cancelled.'));
                return;
            }
            
            if (valueType === 'text') {
                const value = await this.getMultilineInput(`Enter value for ${formattedName}:`);
                
                console.log(chalk.gray('─'.repeat(60)));
                console.log(chalk.cyan('Creating variable...'));
                
                const createResult = await createEnvVar({ 
                    name: formattedName, 
                    value,
                    scope: 'global'
                });
                
                if (createResult.success) {
                    console.log(chalk.green(`✓ Successfully created variable ${formattedName}`));
                    
                    // Display the variable info
                    if (createResult.data) {
                        console.log(chalk.cyan('\nVariable Details:'));
                        console.log(`${chalk.yellow('Name:')} ${formattedName}`);
                        console.log(`${chalk.yellow('Value:')} ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
                        console.log(`${chalk.yellow('Scope:')} global`);
                        console.log(`${chalk.yellow('ID:')} ${createResult.data.id}`);
                        
                        // Add a hint about using the variable list
                        console.log(chalk.cyan('\nThe variable has been created successfully and will appear in the variable list.'));
                    }
                } else {
                    console.error(chalk.red(`✗ Failed to create ${formattedName}`));
                    console.error(chalk.red(`Error: ${createResult.error}`));
                    
                    // Provide suggestion
                    console.log(chalk.cyan('\nTroubleshooting suggestions:'));
                    console.log('- Try a simpler variable name (using only uppercase letters, numbers, and underscores)');
                    console.log('- Check if the database is accessible and not corrupted');
                    console.log('- Try running the CLI with administrator/root privileges');
                }
            } else {
                await this.assignFragmentToNewVariable(formattedName);
            }
        } catch (error) {
            this.handleError(error, 'creating variable interactively');
            
            // Provide more helpful error information
            if (error instanceof Error) {
                console.error(chalk.red(`Error details: ${error.message}`));
                if (error.stack) {
                    console.error(chalk.gray('Stack trace:'));
                    console.error(chalk.gray(error.stack.split('\n').slice(1, 4).join('\n')));
                }
            }
        }
    }
    
    private async assignFragmentToNewVariable(variableName: string): Promise<void> {
        try {
            const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');
            if (!fragments) {
                console.error(chalk.red('No fragments found. Create fragments first.'));
                return;
            }
            
            const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
                'Use ↑↓ to select a fragment: ',
                fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} > ${chalk.blue(f.name)}`,
                    value: f
                }))
            );
            
            if (selectedFragment === 'back') {
                console.log(chalk.yellow('Fragment assignment cancelled.'));
                return;
            }
            
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.cyan(`Creating variable with fragment reference...`));
            
            const fragmentRef = `${FRAGMENT_PREFIX}${selectedFragment.category}/${selectedFragment.name}`;
            
            const createResult = await createEnvVar({
                name: variableName,
                value: fragmentRef,
                scope: 'global'
            });
            
            if (!createResult.success) {
                console.error(chalk.red(`✗ Failed to create ${formatSnakeCase(variableName)}: ${createResult.error}`));
                return;
            }
            
            console.log(chalk.green(`✓ Successfully created variable ${formatSnakeCase(variableName)}`));
            console.log(chalk.green(`✓ Fragment reference assigned: ${fragmentRef}`));
            
            // Display the variable info
            if (createResult.data) {
                console.log(chalk.cyan('\nVariable Details:'));
                console.log(`${chalk.yellow('Name:')} ${variableName}`);
                console.log(`${chalk.yellow('Fragment:')} ${selectedFragment.category}/${selectedFragment.name}`);
                console.log(`${chalk.yellow('Scope:')} global`);
                console.log(`${chalk.yellow('ID:')} ${createResult.data.id}`);
                
                // Add a hint about using the variable list
                console.log(chalk.cyan('\nThe variable has been created successfully and will appear in the variable list.'));
            }
            
            const fragmentContent = await this.handleApiResult(
                await viewFragmentContent(selectedFragment.category, selectedFragment.name),
                `Fetched content for fragment ${fragmentRef}`
            );
            
            if (fragmentContent) {
                console.log(chalk.cyan('\nFragment content preview:'));
                console.log(chalk.gray('─'.repeat(60)));
                console.log(fragmentContent.substring(0, 200) + (fragmentContent.length > 200 ? '...' : ''));
            } else {
                console.log(chalk.yellow('\nWarning: Could not preview fragment content.'));
            }
        } catch (error) {
            this.handleError(error, 'assigning fragment to new variable');
            
            // Provide more helpful error information
            if (error instanceof Error) {
                console.error(chalk.red(`Error details: ${error.message}`));
                if (error.stack) {
                    console.error(chalk.gray('Stack trace:'));
                    console.error(chalk.gray(error.stack.split('\n').slice(1, 4).join('\n')));
                }
            }
        }
    }
    
    private async showVariableInfo(
        key: string, 
        allVariables: Array<{ name: string; role: string; promptIds?: string[] }>,
        envVars: EnvVariable[]
    ): Promise<void> {
        try {
            const formattedKey = formatSnakeCase(key);
            
            // Find variable in all variables
            const variable = allVariables.find(v => formatSnakeCase(v.name) === formattedKey);
            
            // Find environment variable
            const envVar = envVars.find(v => formatSnakeCase(v.name) === formattedKey);
            
            if (!variable && !envVar) {
                if (process.argv.includes('--json')) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Variable ${formattedKey} not found`
                    }, null, 2));
                } else {
                    console.error(chalk.red(`Variable ${formattedKey} not found`));
                }
                return;
            }
            
            // Check if JSON output is requested
            if (process.argv.includes('--json')) {
                let fragmentContent = null;
                
                // If this is a fragment reference, get its content
                if (envVar && envVar.value.startsWith(FRAGMENT_PREFIX)) {
                    const fragmentPath = envVar.value.replace(FRAGMENT_PREFIX, '');
                    const [category, name] = fragmentPath.split('/');
                    
                    if (category && name) {
                        fragmentContent = await this.handleApiResult(
                            await viewFragmentContent(category, name),
                            `Fetched content for fragment ${fragmentPath}`
                        );
                    }
                }
                
                const isSensitive = envVar && (
                    envVar.name.includes('API_KEY') ||
                    envVar.name.includes('SECRET') ||
                    envVar.name.includes('TOKEN') ||
                    /key/i.test(envVar.name)
                );
                
                const promptIds = variable ? (variable.promptIds || []) : [];
                
                const result = {
                    name: formattedKey,
                    description: variable ? variable.role : '',
                    inferred: promptIds.length > 0,
                    prompt_sources: promptIds,
                    status: envVar ? 'set' : 'not_set',
                    value: envVar ? (isSensitive ? null : envVar.value) : null,
                    is_sensitive: !!isSensitive,
                    is_fragment: envVar ? envVar.value.startsWith(FRAGMENT_PREFIX) : false,
                    fragment_content: fragmentContent,
                    fragment_path: envVar && envVar.value.startsWith(FRAGMENT_PREFIX) ? 
                        envVar.value.replace(FRAGMENT_PREFIX, '') : null
                };
                
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            
            // Standard text output
            console.log(chalk.cyan(`\nVariable: ${formattedKey}`));
            console.log(chalk.gray('─'.repeat(60)));
            
            if (variable) {
                if (variable.role) {
                    console.log(`${chalk.yellow('Description:')} ${variable.role}`);
                }
                
                // Check if this variable is inferred from prompts
                const promptIds = variable.promptIds || [];
                const isInferred = promptIds && promptIds.length > 0;
                
                if (isInferred) {
                    console.log(`${chalk.yellow('Used in prompts:')} ${promptIds.join(', ')}`);
                    console.log(`${chalk.yellow('Type:')} Inferred from prompts`);
                    console.log(`${chalk.yellow('Inferred:')} Yes (from ${promptIds.length} prompt${promptIds.length > 1 ? 's' : ''})`);
                } else {
                    console.log(`${chalk.yellow('Type:')} Custom variable (not inferred from prompts)`);
                    console.log(`${chalk.yellow('Inferred:')} No`);
                }
            } else {
                console.log(`${chalk.yellow('Type:')} Custom variable (not inferred from prompts)`);
                console.log(`${chalk.yellow('Inferred:')} No`);
            }
            
            if (envVar) {
                console.log(`${chalk.yellow('Status:')} Set`);
                
                if (envVar.value.startsWith(FRAGMENT_PREFIX)) {
                    console.log(`${chalk.yellow('Type:')} Fragment reference`);
                    console.log(`${chalk.yellow('Value:')} ${chalk.blue(envVar.value)}`);
                    
                    // Try to show fragment content
                    const fragmentPath = envVar.value.replace(FRAGMENT_PREFIX, '');
                    const [category, name] = fragmentPath.split('/');
                    
                    if (category && name) {
                        const fragmentContent = await this.handleApiResult(
                            await viewFragmentContent(category, name),
                            `Fetched content for fragment ${fragmentPath}`
                        );
                        
                        if (fragmentContent) {
                            console.log(`\n${chalk.yellow('Fragment Content Preview:')}`);
                            console.log(chalk.gray('─'.repeat(60)));
                            console.log(fragmentContent.substring(0, 400) + (fragmentContent.length > 400 ? '...' : ''));
                        }
                    }
                } else {
                    const isSensitive =
                        envVar.name.includes('API_KEY') ||
                        envVar.name.includes('SECRET') ||
                        envVar.name.includes('TOKEN') ||
                        /key/i.test(envVar.name);
                        
                    console.log(`${chalk.yellow('Type:')} Text value`);
                    console.log(`${chalk.yellow('Value:')} ${isSensitive ? '********' : envVar.value}`);
                }
            } else {
                console.log(`${chalk.yellow('Status:')} Not set`);
            }
        } catch (error) {
            this.handleError(error, 'showing variable info');
        }
    }
    
    private async showVariableInfoInteractive(
        variable: { name: string; role: string; promptIds: string[] },
        envVar: EnvVariable | undefined
    ): Promise<void> {
        try {
            const formattedName = formatSnakeCase(variable.name);
            
            console.log(chalk.cyan(`\nVariable: ${formattedName}`));
            console.log(chalk.gray('─'.repeat(60)));
            
            if (variable.role) {
                console.log(`${chalk.yellow('Description:')} ${variable.role}`);
            }
            
            if (variable.promptIds.length > 0) {
                console.log(`${chalk.yellow('Used in prompts:')} ${variable.promptIds.join(', ')}`);
                console.log(`${chalk.yellow('Type:')} Inferred from prompts`);
                console.log(`${chalk.yellow('Inferred:')} Yes (from ${variable.promptIds.length} prompt${variable.promptIds.length > 1 ? 's' : ''})`);
            } else {
                console.log(`${chalk.yellow('Type:')} Custom variable (not inferred from prompts)`);
                console.log(`${chalk.yellow('Inferred:')} No`);
            }
            
            if (envVar) {
                console.log(`${chalk.yellow('Status:')} Set`);
                
                if (envVar.value.startsWith(FRAGMENT_PREFIX)) {
                    console.log(`${chalk.yellow('Type:')} Fragment reference`);
                    console.log(`${chalk.yellow('Value:')} ${chalk.blue(envVar.value)}`);
                    
                    // Try to show fragment content
                    const fragmentPath = envVar.value.replace(FRAGMENT_PREFIX, '');
                    const [category, name] = fragmentPath.split('/');
                    
                    if (category && name) {
                        const fragmentContent = await this.handleApiResult(
                            await viewFragmentContent(category, name),
                            `Fetched content for fragment ${fragmentPath}`
                        );
                        
                        if (fragmentContent) {
                            console.log(`\n${chalk.yellow('Fragment Content Preview:')}`);
                            console.log(chalk.gray('─'.repeat(60)));
                            console.log(fragmentContent.substring(0, 400) + (fragmentContent.length > 400 ? '...' : ''));
                        }
                    }
                } else {
                    const isSensitive =
                        envVar.name.includes('API_KEY') ||
                        envVar.name.includes('SECRET') ||
                        envVar.name.includes('TOKEN') ||
                        /key/i.test(envVar.name);
                        
                    console.log(`${chalk.yellow('Type:')} Text value`);
                    console.log(`${chalk.yellow('Value:')} ${isSensitive ? '********' : envVar.value}`);
                }
            } else {
                console.log(`${chalk.yellow('Status:')} Not set`);
            }
        } catch (error) {
            this.handleError(error, 'showing variable info interactively');
        }
    }
    
    private async viewVariableValue(key: string, envVars: EnvVariable[]): Promise<void> {
        try {
            const formattedKey = formatSnakeCase(key);
            
            // Find environment variable
            const envVar = envVars.find(v => formatSnakeCase(v.name) === formattedKey);
            
            if (!envVar) {
                console.error(chalk.red(`Variable ${formattedKey} not set`));
                return;
            }
            
            if (envVar.value.startsWith(FRAGMENT_PREFIX)) {
                // For fragment references, show the actual fragment content
                const fragmentPath = envVar.value.replace(FRAGMENT_PREFIX, '');
                const [category, name] = fragmentPath.split('/');
                
                if (category && name) {
                    const fragmentContent = await this.handleApiResult(
                        await viewFragmentContent(category, name),
                        ''
                    );
                    
                    if (fragmentContent) {
                        console.log(fragmentContent);
                    } else {
                        console.error(chalk.red(`Fragment ${fragmentPath} not found`));
                    }
                } else {
                    console.error(chalk.red(`Invalid fragment reference: ${envVar.value}`));
                }
            } else {
                // For regular values, just show the value
                const isSensitive =
                    envVar.name.includes('API_KEY') ||
                    envVar.name.includes('SECRET') ||
                    envVar.name.includes('TOKEN') ||
                    /key/i.test(envVar.name);
                    
                if (isSensitive) {
                    console.error(chalk.red('Cannot view sensitive value'));
                } else {
                    console.log(envVar.value);
                }
            }
        } catch (error) {
            this.handleError(error, 'viewing variable value');
        }
    }
    
    private async showVariableSources(
        key: string,
        allVariables: Array<{ name: string; role: string; promptIds?: string[] }>,
        showTitles: boolean = false
    ): Promise<void> {
        try {
            const formattedKey = formatSnakeCase(key);
            
            // Find variable in all variables
            const variable = allVariables.find(v => formatSnakeCase(v.name) === formattedKey);
            
            if (!variable) {
                console.error(chalk.red(`Variable ${formattedKey} not found`));
                return;
            }
            
            const promptIds = variable.promptIds || [];
            
            // Check if JSON output is requested
            if (process.argv.includes('--json')) {
                // Get prompt titles if requested
                let promptDetails = promptIds.map(id => ({ id }));
                
                if (showTitles) {
                    const prompts = await this.handleApiResult(
                        await listPrompts(),
                        `Fetched prompts list`
                    );
                    
                    if (prompts) {
                        promptDetails = promptIds.map(id => {
                            const prompt = prompts.find(p => p.id && p.id.toString() === id);
                            return {
                                id,
                                title: prompt ? prompt.title : '(Unknown prompt)'
                            };
                        });
                    }
                }
                
                const result = {
                    variable: formattedKey,
                    description: variable.role || '',
                    is_inferred: promptIds.length > 0,
                    prompt_count: promptIds.length,
                    sources: promptDetails
                };
                
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            
            // Standard text output
            console.log(chalk.cyan(`\nVariable: ${formattedKey}`));
            console.log(chalk.gray('─'.repeat(60)));
            
            if (variable.role) {
                console.log(`${chalk.yellow('Description:')} ${variable.role}`);
            }
            
            if (promptIds.length === 0) {
                console.log(`${chalk.yellow('Sources:')} Custom variable (not used in any prompts)`);
                return;
            }
            
            console.log(`${chalk.yellow('Used in')} ${promptIds.length} ${promptIds.length === 1 ? 'prompt' : 'prompts'}:`);
            console.log(chalk.gray('─'.repeat(60)));
            
            if (showTitles) {
                // Get all prompts to find their titles
                const prompts = await this.handleApiResult(
                    await listPrompts(),
                    `Fetched prompts list`
                );
                
                if (!prompts) {
                    console.log(promptIds.join('\n'));
                    return;
                }
                
                // Map prompt IDs to titles
                for (const promptId of promptIds) {
                    const prompt = prompts.find(p => p.id && p.id.toString() === promptId);
                    if (prompt) {
                        console.log(`${chalk.green(promptId.padEnd(4))} ${prompt.title}`);
                    } else {
                        console.log(`${chalk.green(promptId.padEnd(4))} (Unknown prompt)`);
                    }
                }
            } else {
                // Just show the IDs
                console.log(promptIds.join('\n'));
            }
        } catch (error) {
            this.handleError(error, 'showing variable sources');
        }
    }

    private async enterValueForVariable(
        variable: { name: string; role: string; promptIds: string[] },
        envVar: EnvVariable | undefined
    ): Promise<void> {
        try {
            const currentValue = envVar?.value || '';
            const value = await this.getMultilineInput(`Value for ${formatSnakeCase(variable.name)}`, currentValue);

            if (envVar) {
                const updateResult = await updateEnvVar(envVar.id, value);

                if (updateResult.success) {
                    console.log(chalk.green(`Updated value for ${formatSnakeCase(variable.name)}`));
                } else {
                    throw new Error(`Failed to update ${formatSnakeCase(variable.name)}: ${updateResult.error}`);
                }
            } else {
                const createResult = await createEnvVar({ name: variable.name, value, scope: 'global' });

                if (createResult.success) {
                    console.log(chalk.green(`Created environment variable ${formatSnakeCase(variable.name)}`));
                } else {
                    throw new Error(`Failed to create ${formatSnakeCase(variable.name)}: ${createResult.error}`);
                }
            }
        } catch (error) {
            this.handleError(error, 'entering value for variable');
        }
    }

    private async assignFragmentToVariable(variable: { name: string; role: string; promptIds: string[] }): Promise<void> {
        try {
            const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragments) return;

            console.clear();
            printSectionHeader('Edit Environment Variable', '♻️');

            const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
                'Use ↑↓ to select a fragment: ',
                fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} > ${chalk.blue(f.name)}`,
                    value: f
                })),
                {
                    clearConsole: false
                }
            );

            if (selectedFragment === 'back') {
                console.log(chalk.yellow('Fragment assignment cancelled.'));
                return;
            }

            const fragmentRef = `${FRAGMENT_PREFIX}${selectedFragment.category}/${selectedFragment.name}`;
            const envVars = await this.handleApiResult(await readEnvVars(), 'Fetched environment variables');

            if (!envVars) return;

            const existingEnvVar = envVars.find((v) => v.name === variable.name);

            if (existingEnvVar) {
                const updateResult = await updateEnvVar(existingEnvVar.id, fragmentRef);

                if (!updateResult.success) {
                    throw new Error(`Failed to update ${formatSnakeCase(variable.name)}: ${updateResult.error}`);
                }
            } else {
                const createResult = await createEnvVar({
                    name: variable.name,
                    value: fragmentRef,
                    scope: 'global'
                });

                if (!createResult.success) {
                    throw new Error(`Failed to create ${formatSnakeCase(variable.name)}: ${createResult.error}`);
                }
            }

            console.log(chalk.green(`Fragment reference assigned to ${formatSnakeCase(variable.name)}`));

            const fragmentContent = await this.handleApiResult(
                await viewFragmentContent(selectedFragment.category, selectedFragment.name),
                `Fetched content for fragment ${fragmentRef}`
            );

            if (fragmentContent) {
                console.log(chalk.cyan('Fragment content preview:'));
                console.log(fragmentContent.substring(0, 200) + (fragmentContent.length > 200 ? '...' : ''));
            }
        } catch (error) {
            this.handleError(error, 'assigning fragment to variable');
        }
    }

    private async unsetVariable(
        variable: { name: string; role: string; promptIds?: string[] },
        envVar: EnvVariable | undefined
    ): Promise<void> {
        try {
            if (envVar) {
                // Check if this variable is inferred from prompts
                // First, check if the variable has promptIds in its object (set by getAllUniqueVariables)
                let isInferred = false;
                if (variable.promptIds && variable.promptIds.length > 0) {
                    isInferred = true;
                } else {
                    // Double-check with getAllUniqueVariables if needed
                    const allVariables = await this.getAllUniqueVariables();
                    const matchedVar = allVariables.find(v => formatSnakeCase(v.name) === formatSnakeCase(variable.name));
                    isInferred = !!(matchedVar && matchedVar.promptIds && matchedVar.promptIds.length > 0);
                }
                
                if (isInferred) {
                    // For inferred variables, we should only unset the value, not delete it
                    const updateResult = await updateEnvVar(envVar.id, '');
                    if (updateResult.success) {
                        console.log(chalk.green(`Unset value for ${formatSnakeCase(variable.name)} (inferred variable)`));
                        // Force reload env vars after update
                        await readEnvVars();
                    } else {
                        throw new Error(`Failed to unset ${formatSnakeCase(variable.name)}: ${updateResult.error}`);
                    }
                } else {
                    // For custom variables, we can delete them
                    const deleteResult = await deleteEnvVar(envVar.id);
                    if (deleteResult.success) {
                        console.log(chalk.green(`Deleted variable ${formatSnakeCase(variable.name)}`));
                        // Force reload env vars after deletion
                        await readEnvVars();
                    } else {
                        throw new Error(`Failed to delete ${formatSnakeCase(variable.name)}: ${deleteResult.error}`);
                    }
                }
            } else {
                console.log(chalk.yellow(`${formatSnakeCase(variable.name)} is already empty`));
            }
        } catch (error) {
            this.handleError(error, 'unsetting variable');
        }
    }

    private async getAllUniqueVariables(): Promise<Array<{ name: string; role: string; promptIds: string[] }>> {
        try {
            const prompts = await this.handleApiResult(await listPrompts(), 'Fetched prompts');
            const envVarsResult = await readEnvVars();
            const envVars = envVarsResult.success ? (envVarsResult.data || []) : [];

            const uniqueVariables = new Map<string, { name: string; role: string; promptIds: string[] }>();
            
            // First collect all variables from prompts
            if (prompts) {
                for (const prompt of prompts) {
                    if (!prompt.id) {
                        continue;
                    }

                    const details = await this.handleApiResult(
                        await getPromptFiles(prompt.id),
                        `Fetched details for prompt ${prompt.id}`
                    );

                    if (details) {
                        details.metadata.variables.forEach((v) => {
                            const normalizedName = v.name;
                            const promptIdStr = prompt.id ? prompt.id.toString() : '';
                            
                            if (!uniqueVariables.has(normalizedName)) {
                                uniqueVariables.set(normalizedName, { 
                                    name: normalizedName, 
                                    role: v.role,
                                    promptIds: promptIdStr ? [promptIdStr] : []
                                });
                            } else {
                                // Add this prompt to the list of prompts where this variable is used
                                const existingVar = uniqueVariables.get(normalizedName);
                                if (existingVar && promptIdStr && !existingVar.promptIds.includes(promptIdStr)) {
                                    existingVar.promptIds.push(promptIdStr);
                                }
                            }
                        });
                    }
                }
            }
            
            // Then add any custom variables from the database that aren't already in the list
            for (const envVar of envVars) {
                const normalizedName = envVar.name;
                
                if (!uniqueVariables.has(normalizedName)) {
                    uniqueVariables.set(normalizedName, {
                        name: normalizedName,
                        role: 'Custom environment variable',
                        promptIds: []
                    });
                }
            }
            
            return Array.from(uniqueVariables.values()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            this.handleError(error, 'getting all unique variables');
            return [];
        }
    }
}

export default new EnvCommand();
