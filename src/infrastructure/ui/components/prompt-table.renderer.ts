import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { TableRenderer } from './table.renderer';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../../../shared/constants';
import { PromptVariable, MenuItem } from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';

@Injectable({ scope: Scope.DEFAULT })
export class PromptTableRenderer extends TableRenderer {
    constructor(
        @Inject(forwardRef(() => StringFormatterService))
        stringFormatterService: StringFormatterService
    ) {
        super(stringFormatterService);
    }

    formatVariableAssignmentChoices(variables: PromptVariable[], envVars: any[] = []): Array<MenuItem<PromptVariable>> {
        return variables.map((variable) => {
            const name = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
            let displayText = name;
            const hasMatchingEnv = envVars.some(
                (env) => this.stringFormatterService.formatSnakeCase(env.name) === name
            );

            if (variable.value) {
                const valuePreview =
                    variable.value.length > 30 ? variable.value.substring(0, 30) + '...' : variable.value;

                if (variable.value.startsWith(FRAGMENT_PREFIX)) {
                    displayText = `${chalk.blue(`${name}`)} ${chalk.dim(`[${FRAGMENT_PREFIX} ${valuePreview.replace(FRAGMENT_PREFIX, '')}]`)}`;
                } else if (variable.value.startsWith(ENV_PREFIX)) {
                    displayText = `${chalk.magenta(`${name}`)} ${chalk.dim(`[${ENV_PREFIX} ${valuePreview.replace(ENV_PREFIX, '')}]`)}`;
                } else {
                    displayText = `${chalk.green(`${name}`)} ${chalk.dim(`[Set: ${valuePreview}]`)}`;
                }
            } else if (!variable.optional_for_user) {
                displayText = `${chalk.red(`${name} (*Required*)`)}`;
            } else if (hasMatchingEnv) {
                displayText = `${chalk.yellow(`${name}`)} ${chalk.dim('[ENV available]')}`;
            } else {
                displayText = `${chalk.dim(`${name} (Optional)`)}`;
            }
            return {
                name: displayText,
                value: variable,
                type: 'item'
            };
        });
    }
}
