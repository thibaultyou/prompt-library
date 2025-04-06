import { execSync } from 'child_process';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { ConsoleFacade } from './console.facade';
import { MENU_DISPLAY, SEPARATOR } from '../../../shared/constants';
import { SpinnerWithStatus, MenuItem, StyleType, MenuOptions, TableFormatResult } from '../../../shared/types';
import { MenuBuilder } from '../components/menu.builder';
import { TableRenderer } from '../components/table.renderer';
import { TextFormatter } from '../components/text.formatter';

@Injectable({ scope: Scope.DEFAULT })
export class UiFacade {
    constructor(
        @Inject(forwardRef(() => MenuBuilder))
        private readonly menuBuilder: MenuBuilder,
        public readonly textFormatter: TextFormatter,
        public readonly tableRenderer: TableRenderer,
        private readonly consoleFacade: ConsoleFacade
    ) {}

    public calculateOptimalPageSize(menuType: MenuOptions['menuType'] = 'default'): number {
        try {
            const defaultPageSize = MENU_DISPLAY.PAGE_SIZE;
            let terminalRows: number | undefined;

            if (process.stdout.rows) terminalRows = process.stdout.rows;
            else if (process.env.LINES) terminalRows = parseInt(process.env.LINES, 10);
            else {
                try {
                    const output = execSync('tput lines', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });

                    if (output && !isNaN(parseInt(output, 10))) terminalRows = parseInt(output, 10);
                    // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_err) {
                    console.debug('Failed to get terminal size via tput');
                }
            }

            if (!terminalRows || isNaN(terminalRows)) return defaultPageSize;

            let estimatedHeaderHeight = 2;

            if (menuType === 'main') estimatedHeaderHeight = 6;

            const reservedSpace = 4;
            const availableSpace = terminalRows - estimatedHeaderHeight - reservedSpace;
            return Math.max(5, Math.min(availableSpace, defaultPageSize));
        } catch (error) {
            console.error('Error calculating optimal page size:', error);
            return MENU_DISPLAY.PAGE_SIZE;
        }
    }

    public showSpinner(message: string): SpinnerWithStatus {
        return this.menuBuilder.showSpinner(message);
    }

    public formatMenuItem<T>(text: string, value: T, style?: StyleType, disabled?: boolean | string): MenuItem<T> {
        const effectiveStyle = style ?? 'primary';
        return this.textFormatter.formatMenuItem(text, value, effectiveStyle, disabled);
    }

    public createPromptActionChoices<_T = string>(options?: {
        isPromptFavorite?: boolean;
        hasConversationHistory?: boolean;
        canEditPrompt?: boolean;
    }): Array<any> {
        return this.menuBuilder.createPromptActionChoices(options);
    }

    public async showProgress<T>(message: string, promise: Promise<T>): Promise<T> {
        return this.menuBuilder.showProgress(message, promise);
    }

    public async getInput(message: string, defaultValue?: string, allowCancel?: boolean): Promise<string | null> {
        return this.menuBuilder.getInput(message, defaultValue, allowCancel);
    }

    public async getMultilineInput(
        message: string,
        initialValue?: string,
        options?: { instructionMessage?: string; postfix?: string }
    ): Promise<string> {
        return this.menuBuilder.getMultilineInput(message, initialValue, options);
    }

    public async confirm(message: string, defaultValue?: boolean): Promise<boolean> {
        return this.menuBuilder.confirm(message, defaultValue);
    }

    public formatOperationType(type: string): string {
        return this.textFormatter.formatOperationType(type);
    }

    public formatRepositoryOperation(operation: string, path: string): string {
        const formattedOperation = this.formatOperationType(operation);
        return `${formattedOperation} ${chalk.white(path)}`;
    }

    public createTableMenuChoices<T, U = never>(
        tableData: TableFormatResult<T>,
        options: {
            infoText?: string;
            extraActions?: Array<{ name: string; value: U; style?: StyleType }>;
            backLabel?: string;
            includeGoBack?: boolean;
        } = {}
    ): Array<MenuItem<T | U | 'back'>> {
        return this.tableRenderer.createTableMenuChoices<T, U>(tableData, options);
    }

    public clearConsole(): void {
        this.consoleFacade.clear();
    }

    public printSectionHeader(title: string, icon?: string): void {
        this.textFormatter.printSectionHeader(title, icon);
    }

    public printSeparator(character?: string, length?: number): void {
        const sepChar = character || SEPARATOR.CHAR;
        const sepLength = length || SEPARATOR.LENGTH;
        this.consoleFacade.log(this.textFormatter.dim(sepChar.repeat(sepLength)));
    }

    public print(message: string, style?: StyleType | 'bold' | 'dim', styleType?: StyleType): void {
        if (style === 'bold') this.consoleFacade.log(this.textFormatter.bold(message, styleType));
        else if (style === 'dim') this.consoleFacade.log(this.textFormatter.dim(message));
        else if (style) this.consoleFacade.log(this.textFormatter.style(message, style));
        else this.consoleFacade.log(message);
    }

    public async pressKeyToContinue(message?: string): Promise<void> {
        return this.menuBuilder.pressKeyToContinue(message);
    }

    public async selectMenu<T>(message: string, choices: Array<MenuItem<T>>, options?: MenuOptions<T>): Promise<T> {
        const opts = options || {};

        if (!opts.pageSize) {
            opts.pageSize = this.calculateOptimalPageSize(opts.menuType || 'default');
        }
        return this.menuBuilder.selectMenu<T>(message, choices, opts);
    }

    public formatMessage(template: string, ...args: unknown[]): string {
        return this.consoleFacade.formatMessage(template, ...args);
    }
}
