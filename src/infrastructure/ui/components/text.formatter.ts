import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

import { UI_ICONS, SEPARATOR, TEXT_FORMAT, ENV_PREFIX, FRAGMENT_PREFIX, STYLE_TYPES } from '../../../shared/constants';
import { StyleType, PromptMetadata, PromptVariable, MenuItem } from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';

@Injectable({ scope: Scope.DEFAULT })
export class TextFormatter {
    constructor(
        @Inject(forwardRef(() => StringFormatterService))
        protected readonly stringFormatterService: StringFormatterService
    ) {}

    private readonly STYLE_COLOR_MAP: Record<StyleType, chalk.ChalkFunction> = {
        success: chalk.green,
        warning: chalk.yellow,
        danger: chalk.red,
        error: chalk.red,
        info: chalk.blue,
        primary: chalk.cyan,
        secondary: chalk.magenta,
        debug: chalk.gray,
        bold: chalk.bold,
        dim: chalk.dim
    };
    private readonly SUCCESS_ICON = UI_ICONS.SUCCESS;
    private readonly WARNING_ICON = UI_ICONS.WARNING;
    private readonly ERROR_ICON = UI_ICONS.ERROR;
    private readonly DEFAULT_HEADER_EMOJI = UI_ICONS.DEFAULT_HEADER;
    private readonly SEPARATOR_LINE_LENGTH = SEPARATOR.LINE_LENGTH;
    private readonly ELLIPSIS = TEXT_FORMAT.TRUNCATION.ELLIPSIS;
    private readonly DEFAULT_TRUNCATE_LENGTH = TEXT_FORMAT.TRUNCATION.DEFAULT_LENGTH;

    formatMenuItem<T>(
        text: string,
        value: T,
        style: StyleType = 'primary',
        disabled: boolean | string = false
    ): MenuItem<T> {
        const colorFn = this.STYLE_COLOR_MAP[style] || this.STYLE_COLOR_MAP.primary;
        return { name: colorFn(text), value, disabled, type: 'item' };
    }

    createSectionHeader<T>(title: string, emoji: string = '', style: StyleType = 'primary'): MenuItem<T> {
        const styleFn = this.getHeaderStyleFunction(style);
        const headerText = emoji ? `${emoji} ${title}` : title;
        return { name: styleFn(headerText), value: 'header' as unknown as T, disabled: ' ', type: 'header' };
    }

    createCategoryHeader<T>(category: string, emoji: string = '📁', style: StyleType = 'primary'): MenuItem<T> {
        const styleFn = this.getHeaderStyleFunction(style);
        return {
            name: styleFn(`${emoji} ${category}`),
            value: 'header' as unknown as T,
            disabled: ' ',
            type: 'header'
        };
    }

    createSeparator<T>(length: number = this.SEPARATOR_LINE_LENGTH): MenuItem<T> {
        return { name: '─'.repeat(length), value: 'separator' as unknown as T, disabled: ' ', type: 'separator' };
    }

    printSectionHeader(title: string, emoji: string = this.DEFAULT_HEADER_EMOJI): void {
        console.log('\n' + chalk.bold(this.STYLE_COLOR_MAP.primary(`${emoji} ${title}`)));
        console.log('─'.repeat(this.SEPARATOR_LINE_LENGTH));
    }

    printExamples(examples: string[]): void {
        console.log(this.STYLE_COLOR_MAP.warning('\nExamples:'));
        examples.forEach((example) => console.log(`  ${example}`));
        console.log('');
    }

    successMessage(message: string): string {
        return this.STYLE_COLOR_MAP.success(`${this.SUCCESS_ICON} ${message}`);
    }

    warningMessage(message: string): string {
        return this.STYLE_COLOR_MAP.warning(`${this.WARNING_ICON} ${message}`);
    }

    errorMessage(message: string): string {
        return this.STYLE_COLOR_MAP.danger(`${this.ERROR_ICON} ${message}`);
    }

    infoMessage(message: string): string {
        return this.STYLE_COLOR_MAP.info(`ℹ️ ${message}`);
    }

    formatKeyValue(key: string, value: string): string {
        return `${this.STYLE_COLOR_MAP.primary(key)}: ${value}`;
    }

    truncateString(str: string, maxLength: number = this.DEFAULT_TRUNCATE_LENGTH): string {
        if (!str || str.length <= maxLength) return str || '';

        const truncatedLength = maxLength - this.ELLIPSIS.length;
        return str.substring(0, truncatedLength) + this.ELLIPSIS;
    }

    private getHeaderStyleFunction(style: StyleType): (text: string) => string {
        const colorFn = this.STYLE_COLOR_MAP[style] || this.STYLE_COLOR_MAP.primary;
        return (text: string) => chalk.bold(colorFn(text));
    }

    style(text: string, style: StyleType = 'primary'): string {
        const colorFn = this.STYLE_COLOR_MAP[style] || this.STYLE_COLOR_MAP.primary;
        return colorFn(text);
    }

    bold(text: string, style?: StyleType): string {
        return style ? chalk.bold(this.style(text, style)) : chalk.bold(text);
    }

    dim(text: string): string {
        return chalk.dim(text);
    }

    italic(text: string): string {
        return chalk.italic(text);
    }

    createSpinner(text: string): Ora {
        return ora({ text, spinner: 'dots', color: 'cyan' });
    }

    formatPromptMetadata(
        metadata: PromptMetadata,
        options: { showVerbose?: boolean; showTitle?: boolean; showId?: boolean; showVariables?: boolean } = {}
    ): string {
        const { showVerbose = true, showTitle = true, showId = true, showVariables = true } = options;
        const lines: string[] = [];

        if (showTitle) lines.push(chalk.bold(chalk.blue(metadata.title)));

        if (showId && metadata.id) lines.push(this.formatKeyValue('ID', metadata.id));

        const directory = metadata.directory.split('/').pop() || metadata.directory;
        lines.push(this.formatKeyValue('Directory', directory));
        lines.push(this.formatKeyValue('Category', this.style(metadata.primary_category, STYLE_TYPES.INFO)));

        if (metadata.subcategories && metadata.subcategories.length > 0)
            lines.push(this.formatKeyValue('Subcategories', metadata.subcategories.join(', ')));

        if (showVerbose) {
            if (metadata.description) lines.push('', metadata.description);

            const tags = typeof metadata.tags === 'string' ? metadata.tags.split(',') : metadata.tags;

            if (tags && tags.length > 0) {
                lines.push('', 'Tags:', tags.map((tag) => chalk.gray(`#${tag.trim()}`)).join(' '));
            }

            if (showVariables && metadata.variables && metadata.variables.length > 0) {
                lines.push('', 'Variables:');
                metadata.variables.forEach((variable: PromptVariable) => {
                    const optionalText = variable.optional_for_user ? ' (optional)' : '';
                    lines.push(`- ${chalk.cyan(variable.name)}${optionalText}: ${variable.role}`);
                });
            }
        }
        return lines.join('\n');
    }

    formatPromptDetailsWithVariables(details: PromptMetadata): string {
        const lines: string[] = [this.formatPromptMetadata(details, { showVariables: false })];

        if (!details.variables || details.variables.length === 0) return lines.join('\n');

        lines.push('\nOptions: ' + chalk.gray('(*) Required  ( ) Optional'));
        const maxNameLength = Math.max(
            ...details.variables.map((v) => this.stringFormatterService.formatSnakeCase(v.name).length)
        );

        for (const variable of details.variables) {
            const varName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
            const required = !variable.optional_for_user;
            const hasValue = variable.value && variable.value.trim() !== '';
            const prefix = required ? '(*)' : '( )';
            const status = hasValue ? chalk.green('✓') : chalk.gray('•');
            lines.push(`${prefix} ${status} ${varName.padEnd(maxNameLength + 2)}${chalk.gray(variable.role || '')}`);

            if (hasValue) {
                const value = variable.value || '';
                let displayValue = '';

                if (value.startsWith(ENV_PREFIX)) {
                    const envVarName = value.replace(ENV_PREFIX, '').trim();
                    displayValue = `Env → ${this.stringFormatterService.formatSnakeCase(envVarName)}`;
                } else if (value.startsWith(FRAGMENT_PREFIX)) {
                    const fragmentName = value.replace(FRAGMENT_PREFIX, '').trim();
                    displayValue = `Fragment → ${this.stringFormatterService.formatSnakeCase(fragmentName)}`;
                } else {
                    displayValue = value.length > 60 ? value.substring(0, 60) + '...' : value.replace(/\r?\n|\r/g, '');
                }

                let coloredValue;

                if (value.startsWith(ENV_PREFIX)) coloredValue = chalk.magenta(displayValue);
                else if (value.startsWith(FRAGMENT_PREFIX)) coloredValue = chalk.blue(displayValue);
                else coloredValue = chalk.green(displayValue);

                lines.push(`    ${chalk.dim('→')} ${coloredValue}`);
            }
        }
        lines.push('');
        return lines.join('\n');
    }

    formatOperationType(type: string): string {
        const lowerType = type.toLowerCase();

        if (lowerType.includes('delete')) return chalk.red(type.padEnd(8));

        if (lowerType.includes('restore')) return chalk.yellow(type.padEnd(8));

        if (lowerType.includes('add')) return chalk.green(type.padEnd(8));

        if (lowerType.includes('modify') || lowerType.includes('update')) return chalk.blue(type.padEnd(8));
        return chalk.cyan(type.padEnd(8));
    }
}
