import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { TableRenderer } from './table.renderer';
import { FRAGMENT_PREFIX } from '../../../shared/constants';
import { EnvVariable, MenuItem } from '../../../shared/types';
import { TableFormatResult, TableColumn } from '../../../shared/types/ui';
import { StringFormatterService } from '../../common/services/string-formatter.service';

@Injectable({ scope: Scope.DEFAULT })
export class VariableTableRenderer extends TableRenderer {
    constructor(
        @Inject(forwardRef(() => StringFormatterService))
        stringFormatterService: StringFormatterService
    ) {
        super(stringFormatterService);
    }

    formatEnvironmentVariablesTable(
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        envVars: EnvVariable[]
    ): TableFormatResult<{ name: string; role: string; promptIds: string[] }> {
        const formattedEnvVars = envVars.map((v) => ({
            ...v,
            formattedName: this.stringFormatterService.formatSnakeCase(v.name)
        }));
        const columns: TableColumn<{ name: string; role: string; promptIds: string[] }>[] = [
            {
                key: 'name',
                header: 'Variable',
                formatter: (v) => chalk.cyan(this.stringFormatterService.formatSnakeCase(String(v)))
            },
            {
                key: 'promptIds',
                header: 'Source',
                formatter: (v) => chalk.yellow(this.formatSourceColumn(v as string[]))
            },
            {
                key: 'name',
                header: 'Status',
                formatter: (v) => {
                    const formattedName = this.stringFormatterService.formatSnakeCase(String(v));
                    const envVar = formattedEnvVars.find((ev) => ev.formattedName === formattedName);
                    return this.getVariableStatus(envVar);
                }
            }
        ];
        const sort = (a: { name: string }, b: { name: string }) =>
            this.stringFormatterService
                .formatSnakeCase(a.name)
                .localeCompare(this.stringFormatterService.formatSnakeCase(b.name));
        return this.formatTable(allVariables, columns, { sort });
    }

    formatVariableChoices(
        allVariables: Array<{ name: string; role: string; promptIds: string[] }>,
        envVars: EnvVariable[]
    ): Array<MenuItem<{ name: string; role: string; promptIds: string[] }>> {
        const formattedEnvVars = envVars.map((v) => ({
            ...v,
            formattedName: this.stringFormatterService.formatSnakeCase(v.name)
        }));
        const maxNameLength = Math.max(
            ...allVariables.map((v) => this.stringFormatterService.formatSnakeCase(v.name).length)
        );
        return allVariables.map((variable) => {
            const formattedName = this.stringFormatterService.formatSnakeCase(variable.name);
            const paddedName = formattedName.padEnd(maxNameLength);
            const envVar = formattedEnvVars.find((v) => v.formattedName === formattedName);
            const status = this.getVariableStatus(envVar);
            return { name: `${paddedName} --> ${status}`, value: variable, type: 'item' };
        });
    }

    private getVariableStatus(envVar: EnvVariable | undefined): string {
        if (!envVar) return chalk.yellow('Not Set');

        const trimmedValue = envVar.value.trim();

        if (trimmedValue === '') return chalk.yellow('Not Set');

        if (trimmedValue.startsWith(FRAGMENT_PREFIX))
            return chalk.blue(`Fragment: ${trimmedValue.replace(FRAGMENT_PREFIX, '')}`);

        const isSensitive = /API_KEY|SECRET|TOKEN|PASSWORD/i.test(envVar.name);
        return chalk.green(
            isSensitive
                ? 'Set: ********'
                : `Set: ${trimmedValue.substring(0, 20)}${trimmedValue.length > 20 ? '...' : ''}`
        );
    }

    private formatSourceColumn(promptIds: string[]): string {
        if (promptIds.length === 0) return 'Custom';
        return promptIds.length < 5 ? promptIds.join(', ') : `${promptIds.length} prompts`;
    }

    createEnvVarMenuChoices(
        tableData: TableFormatResult<{ name: string; role: string; promptIds: string[] }>,
        options: { infoText?: string; createVariableLabel?: string } = {}
    ): Array<MenuItem<{ name: string; role: string; promptIds: string[] } | 'back' | 'refresh' | 'create'>> {
        const { infoText, createVariableLabel = 'Create new custom variable' } = options;
        type ExtraActionType = 'refresh' | 'create';
        const baseChoices = this.createTableMenuChoices<
            { name: string; role: string; promptIds: string[] },
            ExtraActionType
        >(tableData, { infoText, includeGoBack: false });
        const backIndex = baseChoices.findIndex((c) => c.value === 'back');
        const createOption: MenuItem<'create'> = {
            name: chalk.cyan(createVariableLabel),
            value: 'create',
            type: 'item'
        };

        if (backIndex !== -1) {
            baseChoices.splice(backIndex, 0, createOption as any);
        } else {
            baseChoices.push(createOption as any);
        }
        return baseChoices as Array<
            MenuItem<{ name: string; role: string; promptIds: string[] } | 'back' | 'refresh' | 'create'>
        >;
    }
}
