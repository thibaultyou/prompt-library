import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { TABLE_FORMAT } from '../../../shared/constants';
import {
    CategoryItem,
    PromptFragment,
    TableColumn,
    TableFormatResult,
    TableFormatOptions,
    StyleType,
    MenuItem
} from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';

@Injectable({ scope: Scope.DEFAULT })
export class TableRenderer {
    constructor(
        @Inject(forwardRef(() => StringFormatterService))
        protected readonly stringFormatterService: StringFormatterService
    ) {}

    formatTable<T extends Record<string, any>>(
        items: T[],
        columns: TableColumn<T>[],
        options: { tableWidth?: number; sort?: (a: T, b: T) => number; includeHeaders?: boolean } = {}
    ): TableFormatResult<T> {
        const { tableWidth = TABLE_FORMAT.WIDTH.DEFAULT, sort, includeHeaders = true } = options;
        const sortedItems = sort ? [...items].sort(sort) : [...items];
        const maxLengths: Record<string, number> = {};
        columns.forEach((column) => {
            maxLengths[column.key] = Math.max(
                includeHeaders ? column.header.length : 0,
                typeof column.width === 'number' ? column.width : 0,
                ...sortedItems.map((item) => {
                    const value = item[column.key];

                    if (value === undefined || value === null) return 0;

                    const formatted = column.formatter ? column.formatter(value, item) : String(value);
                    return this.stripAnsi(formatted).length;
                })
            );
        });
        const headers = includeHeaders
            ? columns.map((column) => chalk.bold(column.header.padEnd(maxLengths[column.key] + 2))).join('')
            : '';
        const separatorLength = Math.min(
            tableWidth,
            columns.reduce((sum, col) => sum + maxLengths[col.key] + 2, 0)
        );
        const separator = includeHeaders ? '─'.repeat(separatorLength) : '';
        const rows = sortedItems.map((item) =>
            columns
                .map((column) => {
                    const value = item[column.key];

                    if (value === undefined || value === null) return ''.padEnd(maxLengths[column.key] + 2);

                    const formattedValue = column.formatter ? column.formatter(value, item) : String(value);
                    const visibleLength = this.stripAnsi(formattedValue).length;
                    const padding = Math.max(0, maxLengths[column.key] - visibleLength);
                    return formattedValue + ' '.repeat(padding + 2);
                })
                .join('')
        );
        return { headers, separator, rows, maxLengths, itemsMap: sortedItems };
    }

    formatPromptsTable(prompts: CategoryItem[], options: TableFormatOptions = {}): TableFormatResult<CategoryItem> {
        const {
            showDirectory = true,
            sortById = false,
            highlightCategory = null,
            tableWidth = TABLE_FORMAT.WIDTH.DEFAULT,
            showDescription = false,
            preserveOrder = false
        } = options;
        const columns: TableColumn<CategoryItem>[] = [
            { key: 'id', header: 'ID', formatter: (v) => chalk.green(String(v)) }
        ];

        if (showDirectory)
            columns.push({
                key: 'path',
                header: 'Directory',
                formatter: (v) => chalk.yellow(String(v).split('/').pop() || '')
            });

        if (!highlightCategory)
            columns.push({
                key: 'primary_category',
                header: 'Category',
                formatter: (v) => chalk.cyan(String(v || ''))
            });

        columns.push({ key: 'title', header: 'Title' });

        if (showDescription)
            columns.push({
                key: 'description',
                header: 'Description',
                formatter: (v) => this.truncate(String(v || ''), TABLE_FORMAT.WIDTH.DESCRIPTION)
            });

        const sort = preserveOrder
            ? undefined
            : (a: CategoryItem, b: CategoryItem) => {
                  if (sortById) return parseInt(a.id) - parseInt(b.id);

                  const aCat = a.category || a.primary_category;
                  const bCat = b.category || b.primary_category;

                  if (aCat !== bCat) return aCat.localeCompare(bCat);
                  return a.title.localeCompare(b.title);
              };
        return this.formatTable(prompts, columns, { tableWidth, sort });
    }

    formatFragmentsTable(
        fragments: PromptFragment[],
        options: { tableWidth?: number; showPath?: boolean } = {}
    ): TableFormatResult<PromptFragment> {
        const { tableWidth = TABLE_FORMAT.WIDTH.DEFAULT, showPath = false } = options;
        const sort = (a: PromptFragment, b: PromptFragment) =>
            a.category !== b.category ? a.category.localeCompare(b.category) : a.name.localeCompare(b.name);
        const columns: TableColumn<PromptFragment>[] = [
            { key: 'category', header: 'Category', formatter: (v) => chalk.green(String(v)) },
            { key: 'name', header: 'Name', formatter: (v) => chalk.cyan(String(v)) }
        ];

        if (showPath)
            columns.push({
                key: 'path',
                header: 'Path',
                formatter: (v, item) => chalk.dim(`fragments/${item.category}/${item.name}`)
            });
        return this.formatTable(fragments, columns, { tableWidth, sort });
    }

    formatCategoryTable(
        categoriesData: Array<{ category: string; count: number }>,
        options: { maxCategoryLength?: number; tableWidth?: number; includeDescriptions?: boolean } = {}
    ): TableFormatResult<{ category: string; count: number; description?: string }> {
        const { tableWidth = TABLE_FORMAT.WIDTH.DEFAULT, includeDescriptions = false, maxCategoryLength } = options;
        const tableData = categoriesData.map((item) => ({
            ...item,
            description: undefined
        }));
        const columns: TableColumn<{ category: string; count: number; description?: string }>[] = [
            { key: 'category', header: 'Category', width: maxCategoryLength, formatter: (v) => chalk.green(String(v)) },
            { key: 'count', header: 'Count', formatter: (v) => chalk.yellow(String(v)) }
        ];
        return this.formatTable(tableData, columns, { tableWidth });
    }

    createTableMenuChoices<T, U = never>(
        tableData: TableFormatResult<T>,
        options: {
            infoText?: string;
            extraActions?: Array<{ name: string; value: U; style?: StyleType }>;
            backLabel?: string;
            includeGoBack?: boolean;
        } = {}
    ): Array<MenuItem<T | U | 'back'>> {
        const { infoText, extraActions = [], backLabel = 'Go back', includeGoBack = false } = options;
        const tableChoices: Array<MenuItem<T | U | 'back'>> = [];

        if (tableData.headers) {
            tableChoices.push({ name: tableData.headers, value: 'back' as any, disabled: true, type: 'header' });
            tableChoices.push({ name: tableData.separator, value: 'back' as any, disabled: true, type: 'separator' });
        }

        tableData.rows.forEach((row, index) => {
            tableChoices.push({ name: row, value: tableData.itemsMap[index], type: 'item' });
        });

        if (tableData.separator) {
            tableChoices.push({ name: tableData.separator, value: 'back' as any, disabled: true, type: 'separator' });
        }

        extraActions.forEach((action) => {
            const style = action.style || 'primary';
            const colorFn = this.getStyleColorFunction(style);
            tableChoices.push({ name: colorFn(action.name), value: action.value, type: 'item' });
        });

        if (infoText) {
            tableChoices.push({
                name: chalk.italic(infoText),
                value: 'back' as any,
                disabled: true,
                type: 'separator'
            });
        }

        if (includeGoBack) {
            tableChoices.push({
                name: this.getStyleColorFunction('danger')(backLabel),
                value: 'back' as any,
                type: 'item'
            });
        }
        return tableChoices;
    }

    private getStyleColorFunction(style: StyleType): (text: string) => string {
        const styleMap: Record<string, chalk.ChalkFunction> = {
            success: chalk.green,
            warning: chalk.yellow,
            danger: chalk.red,
            error: chalk.red,
            info: chalk.blue,
            primary: chalk.cyan,
            secondary: chalk.magenta,
            debug: chalk.gray
        };
        return styleMap[style] || styleMap.primary;
    }

    private stripAnsi(str: string): string {
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    }

    private truncate(str: string, maxLength: number): string {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength - 3) + '...';
    }
}
