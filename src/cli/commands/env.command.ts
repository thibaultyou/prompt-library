import chalk from 'chalk';

import { BaseCommand } from './base.command';
import { EnvVar, Fragment } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string_formatter';
import { createEnvVar, readEnvVars, updateEnvVar, deleteEnvVar } from '../utils/env.util';
import { listFragments, viewFragmentContent } from '../utils/fragment.util';
import { listPrompts, getPromptFiles } from '../utils/prompt.util';

class EnvCommand extends BaseCommand {
    constructor() {
        super('env', 'Manage global environment variables');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        while (true) {
            const allVariables = await this.getAllUniqueVariables();
            const envVars = await this.handleApiResult(await readEnvVars(), 'Fetched environment variables');

            if (!envVars) return;

            const maxNameLength = Math.max(...allVariables.map((v) => formatSnakeCase(v.name).length));
            const choices = allVariables.map((variable) => {
                const formattedName = formatSnakeCase(variable.name);
                const paddedName = formattedName.padEnd(maxNameLength);
                const envVar = envVars.find((v) => formatSnakeCase(v.name) === formattedName);
                let status;

                if (envVar) {
                    if (envVar.value.startsWith('Fragment:')) {
                        status = chalk.blue(envVar.value);
                    } else {
                        status = chalk.green(
                            `Set: ${envVar.value.substring(0, 20)}${envVar.value.length > 20 ? '...' : ''}`
                        );
                    }
                } else {
                    status = chalk.yellow('Not Set');
                }
                return {
                    name: `${chalk.cyan(paddedName)}: ${status}`,
                    value: variable
                };
            });
            const action = await this.showMenu<{ name: string; role: string } | 'back'>(
                'Select a variable to manage:',
                choices
            );

            if (action === 'back') return;

            await this.manageEnvVar(action);
        }
    }

    async manageEnvVar(variable: { name: string; role: string }): Promise<void> {
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

    async enterValueForVariable(variable: { name: string; role: string }, envVar: EnvVar | undefined): Promise<void> {
        const value = await this.getMultilineInput('Enter value:');

        if (envVar) {
            const updateResult = await updateEnvVar(envVar.id, value);

            if (updateResult.success) {
                console.log(chalk.green(`Updated value for ${formatSnakeCase(variable.name)}`));
            } else {
                console.error(chalk.red(`Failed to update ${formatSnakeCase(variable.name)}: ${updateResult.error}`));
            }
        } else {
            const createResult = await createEnvVar({ name: variable.name, value, scope: 'global' });

            if (createResult.success) {
                console.log(chalk.green(`Created environment variable ${formatSnakeCase(variable.name)}`));
            } else {
                console.error(chalk.red(`Failed to create ${formatSnakeCase(variable.name)}: ${createResult.error}`));
            }
        }
    }

    async assignFragmentToVariable(variable: { name: string; role: string }): Promise<void> {
        const fragments = await this.handleApiResult(await listFragments(), 'Fetched fragments');

        if (!fragments) return;

        const selectedFragment = await this.showMenu<Fragment | 'back'>(
            'Select a fragment: ',
            fragments.map((f) => ({
                name: `${formatTitleCase(f.category)} / ${chalk.blue(f.name)}`,
                value: f
            }))
        );

        if (selectedFragment === 'back') {
            console.log(chalk.yellow('Fragment assignment cancelled.'));
            return;
        }

        const fragmentRef = `Fragment: ${selectedFragment.category}/${selectedFragment.name}`;
        console.log(`Selected fragment reference: ${fragmentRef}`);

        const envVars = await this.handleApiResult(await readEnvVars(), 'Fetched environment variables');

        if (!envVars) return;

        const existingEnvVar = envVars.find((v) => v.name === variable.name);

        if (existingEnvVar) {
            const updateResult = await updateEnvVar(existingEnvVar.id, fragmentRef);

            if (updateResult.success) {
                console.log(chalk.green(`Updated ${formatSnakeCase(variable.name)} with fragment reference`));
            } else {
                console.error(chalk.red(`Failed to update ${formatSnakeCase(variable.name)}: ${updateResult.error}`));
            }
        } else {
            const createResult = await createEnvVar({
                name: variable.name,
                value: fragmentRef,
                scope: 'global'
            });

            if (createResult.success) {
                console.log(chalk.green(`Created ${formatSnakeCase(variable.name)} with fragment reference`));
            } else {
                console.error(chalk.red(`Failed to create ${formatSnakeCase(variable.name)}: ${createResult.error}`));
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
    }

    async unsetVariable(variable: { name: string; role: string }, envVar: EnvVar | undefined): Promise<void> {
        if (envVar) {
            const deleteResult = await deleteEnvVar(envVar.id);

            if (deleteResult.success) {
                console.log(chalk.green(`Unset ${formatSnakeCase(variable.name)}`));
            } else {
                console.error(chalk.red(`Failed to unset ${formatSnakeCase(variable.name)}: ${deleteResult.error}`));
            }
        } else {
            console.log(chalk.yellow(`${formatSnakeCase(variable.name)} is already empty`));
        }
    }

    async getAllUniqueVariables(): Promise<Array<{ name: string; role: string }>> {
        const prompts = await this.handleApiResult(await listPrompts(), 'Fetched prompts');

        if (!prompts) return [];

        const uniqueVariables = new Map<string, { name: string; role: string }>();

        for (const prompt of prompts) {
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
    }
}

export default new EnvCommand();
