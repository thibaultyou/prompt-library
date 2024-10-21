import chalk from 'chalk';

import { Prompt, Variable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string_formatter.util';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../cli.constants';
import { readEnvVars } from './env.util';
import { handleError } from './error.util';

export async function viewPromptDetails(details: Prompt & { variables: Variable[] }, isExecute = false): Promise<void> {
    // console.clear();
    console.log(chalk.cyan('Prompt:'), details.title);
    console.log(`\n${details.description || ''}`);
    console.log(chalk.cyan('\nCategory:'), formatTitleCase(details.primary_category));

    let tags: string[] = [];

    if (typeof details.tags === 'string') {
        tags = details.tags.split(',').map((tag) => tag.trim());
    } else if (Array.isArray(details.tags)) {
        tags = details.tags;
    }

    console.log(chalk.cyan('\nTags:'), tags.length > 0 ? tags.join(', ') : 'No tags');
    console.log(chalk.cyan('\nOptions:'), '([*] Required  [ ] Optional)');
    const maxNameLength = Math.max(...details.variables.map((v) => formatSnakeCase(v.name).length));

    try {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];

        for (const variable of details.variables) {
            const paddedName = formatSnakeCase(variable.name).padEnd(maxNameLength);
            const requiredFlag = variable.optional_for_user ? '[ ]' : '[*]';
            const matchingEnvVar = envVars.find((v) => v.name === variable.name);
            let status;

            if (variable.value) {
                if (variable.value.startsWith(FRAGMENT_PREFIX)) {
                    status = chalk.blue(variable.value);
                } else if (variable.value.startsWith(ENV_PREFIX)) {
                    const envVarName = variable.value.split(ENV_PREFIX)[1];
                    const envVar = envVars.find((v: { name: string }) => v.name === envVarName);
                    const envValue = envVar ? envVar.value : 'Not found';
                    status = chalk.magenta(
                        `${ENV_PREFIX}${formatSnakeCase(envVarName)} (${envValue.substring(0, 30)}${envValue.length > 30 ? '...' : ''})`
                    );
                } else {
                    status = chalk.green(
                        `Set: ${variable.value.substring(0, 30)}${variable.value.length > 30 ? '...' : ''}`
                    );
                }
            } else {
                status = variable.optional_for_user ? chalk.yellow('Not Set') : chalk.red('Not Set (Required)');
            }

            const hint =
                !isExecute &&
                matchingEnvVar &&
                (!variable.value || (variable.value && !variable.value.startsWith(ENV_PREFIX)))
                    ? chalk.magenta('(Env variable available)')
                    : '';
            console.log(`  ${chalk.green(`--${paddedName}`)} ${requiredFlag} ${hint}`);
            console.log(`    ${variable.role}`);

            if (!isExecute) {
                console.log(`      ${status}`);
            }
        }

        if (!isExecute) {
            console.log();
        }
    } catch (error) {
        handleError(error, 'viewing prompt details');
    }
}
