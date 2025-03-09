import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { EnvVariable, PromptFragment } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { FRAGMENT_PREFIX } from '../constants';
import { createEnvVar, readEnvVars, updateEnvVar, deleteEnvVar } from '../utils/env-vars';
import { listFragments, viewFragmentContent } from '../utils/fragments';
import { listPrompts, getPromptFiles } from '../utils/prompts';

class EnvCommand extends BaseCommand {
    constructor() {
        super('env', 'Manage global environment variables');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                const allVariables = await this.getAllUniqueVariables();
                const envVars = await this.handleApiResult(await readEnvVars(), 'Fetched environment variables');

                if (!envVars) return;

                const action = await this.showMenu<{ name: string; role: string } | 'back'>(
                    'Select a variable to manage:',
                    this.formatVariableChoices(allVariables, envVars)
                );

                if (action === 'back') return;

                await this.manageEnvVar(action);
            } catch (error) {
                this.handleError(error, 'env command');
                await this.pressKeyToContinue();
            }
        }
    }

    private formatVariableChoices(
        allVariables: Array<{ name: string; role: string }>,
        envVars: EnvVariable[]
    ): Array<{ name: string; value: { name: string; role: string } }> {
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

    private async manageEnvVar(variable: { name: string; role: string }): Promise<void> {
        const envVars = await this.handleApiResult(await readEnvVars(), 'Fetched environment variables');

        if (!envVars) return;

        const envVar = envVars.find((v) => v.name === variable.name);
        const action = await this.showMenu<'enter' | 'fragment' | 'unset' | 'back'>(
            `Choose action for ${formatSnakeCase(variable.name)}:`,
            [
                { name: 'Enter value', value: 'enter' },
                { name: 'Use fragment', value: 'fragment' },
                { name: 'Unset', value: 'unset' }
            ]
        );
        switch (action) {
            case 'enter':
                await this.enterValueForVariable(variable, envVar);
                break;
            case 'fragment':
                await this.assignFragmentToVariable(variable);
                break;
            case 'unset':
                await this.unsetVariable(variable, envVar);
                break;
            case 'back':
                return;
        }

        await this.pressKeyToContinue();
    }

    private async enterValueForVariable(
        variable: { name: string; role: string },
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

    private async assignFragmentToVariable(variable: { name: string; role: string }): Promise<void> {
        try {
            const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragments) return;

            const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
                'Select a fragment: ',
                fragments.map((f) => ({
                    name: `${formatTitleCase(f.category)} > ${chalk.blue(f.name)}`,
                    value: f
                }))
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
        variable: { name: string; role: string },
        envVar: EnvVariable | undefined
    ): Promise<void> {
        try {
            if (envVar) {
                const deleteResult = await deleteEnvVar(envVar.id);

                if (deleteResult.success) {
                    console.log(chalk.green(`Unset ${formatSnakeCase(variable.name)}`));
                } else {
                    throw new Error(`Failed to unset ${formatSnakeCase(variable.name)}: ${deleteResult.error}`);
                }
            } else {
                console.log(chalk.yellow(`${formatSnakeCase(variable.name)} is already empty`));
            }
        } catch (error) {
            this.handleError(error, 'unsetting variable');
        }
    }

    private async getAllUniqueVariables(): Promise<Array<{ name: string; role: string }>> {
        try {
            const prompts = await this.handleApiResult(await listPrompts(), 'Fetched prompts');

            if (!prompts) return [];

            const uniqueVariables = new Map<string, { name: string; role: string }>();

            for (const prompt of prompts) {
                if (!prompt.id) {
                    return [];
                }

                const details = await this.handleApiResult(
                    await getPromptFiles(prompt.id),
                    `Fetched details for prompt ${prompt.id}`
                );

                if (details) {
                    details.metadata.variables.forEach((v) => {
                        if (!uniqueVariables.has(v.name)) {
                            uniqueVariables.set(v.name, { name: v.name, role: v.role });
                        }
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
