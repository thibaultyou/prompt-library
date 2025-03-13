import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

export interface MenuItem<T = string> {
    name: string;
    value: T;
    description?: string;
    disabled?: boolean | string;
    type?: 'header' | 'separator' | 'item';
}

export interface MenuConfig<T> {
    message: string;
    choices: MenuItem<T>[];
    pageSize?: number;
    loop?: boolean;
    theme?: any;
}

export type MenuHeaderStyle = 'success' | 'info' | 'warning' | 'danger' | 'primary';

export function createCategoryHeader<T>(
    category: string,
    emoji: string = '📁',
    style: MenuHeaderStyle = 'primary'
): MenuItem<T> {
    const styleFn = getHeaderStyleFunction(style);
    return {
        name: styleFn(`${emoji} ${category}`),
        value: 'header' as any,
        disabled: ' ',
        type: 'header'
    };
}

export function createSectionHeader<T>(
    title: string,
    emoji: string = '',
    style: MenuHeaderStyle = 'primary'
): MenuItem<T> {
    const styleFn = getHeaderStyleFunction(style);
    const headerText = emoji ? `${emoji} ${title}` : title;
    return {
        name: styleFn(headerText),
        value: 'header' as any,
        disabled: ' ',
        type: 'header'
    };
}

export function createSeparator<T>(length: number = 50, value: T = 'separator' as any): MenuItem<T> {
    return {
        name: '─'.repeat(length),
        value,
        disabled: ' ',
        type: 'separator'
    };
}

function getHeaderStyleFunction(style: MenuHeaderStyle): (text: string) => string {
    switch (style) {
        case 'success':
            return (text: string) => chalk.bold(chalk.green(text));
        case 'warning':
            return (text: string) => chalk.bold(chalk.yellow(text));
        case 'danger':
            return (text: string) => chalk.bold(chalk.red(text));
        case 'info':
            return (text: string) => chalk.bold(chalk.blue(text));
        case 'primary':
        default:
            return (text: string) => chalk.bold(chalk.cyan(text));
    }
}

export function formatMenuItem<T>(
    text: string,
    value: T,
    style: MenuHeaderStyle = 'primary',
    disabled: boolean | string = false
): MenuItem<T> {
    let colorFn;
    switch (style) {
        case 'success':
            colorFn = chalk.green;
            break;
        case 'warning':
            colorFn = chalk.yellow;
            break;
        case 'danger':
            colorFn = chalk.red;
            break;
        case 'info':
            colorFn = chalk.blue;
            break;
        case 'primary':
        default:
            colorFn = chalk.cyan;
            break;
    }
    return {
        name: colorFn(text),
        value,
        disabled,
        type: 'item'
    };
}

export async function selectWithHeaders<T>(config: MenuConfig<T>): Promise<T> {
    const cleanChoices = config.choices.map((choice: any) => {
        if (choice.disabled === 'HEADER') {
            const headerName = choice.name;
            const emoji = headerName.trim().split(' ')[0];
            const text = headerName.trim().replace(emoji, '').trim();
            let formattedName;

            if (headerName.includes('QUICK ACTIONS')) {
                formattedName = chalk.bold(chalk.green(`\n${emoji} ${text}`));
            } else if (headerName.includes('REPOSITORY')) {
                formattedName = chalk.bold(chalk.yellow(`\n${emoji} ${text}`));
            } else {
                formattedName = chalk.bold(chalk.cyan(`\n${emoji} ${text}`));
            }
            return {
                ...choice,
                name: formattedName,
                disabled: ' '
            };
        }
        return choice;
    });
    const newConfig = {
        ...config,
        choices: cleanChoices
    };
    return select(newConfig);
}

export async function showProgress<T>(message: string, promise: Promise<T>): Promise<T> {
    const spinner = new Spinner(`${message} %s`);
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    try {
        const result = await promise;
        spinner.stop(true);
        return result;
    } catch (error) {
        spinner.stop(true);
        throw error;
    }
}

export function printSectionHeader(title: string, emoji: string = '📚'): void {
    console.log('\n' + chalk.bold(chalk.cyan(`${emoji} ${title}`)));
    console.log('─'.repeat(50));
}

export function printExamples(examples: string[]): void {
    console.log(chalk.yellow('\nExamples:'));
    examples.forEach((example) => {
        console.log(`  ${example}`);
    });
    console.log('');
}

export function successMessage(message: string): string {
    return chalk.green(`✅ ${message}`);
}

export function warningMessage(message: string): string {
    return chalk.yellow(`⚠️ ${message}`);
}

export function errorMessage(message: string): string {
    return chalk.red(`❌ ${message}`);
}

export function formatKeyValue(key: string, value: string): string {
    return `${chalk.cyan(key)}: ${value}`;
}

export function truncateString(str: string, maxLength: number = 50): string {
    if (!str) return '';

    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

export function showSpinner(
    message: string
): Spinner & { succeed: (text?: string) => void; fail: (text?: string) => void } {
    const spinner = new Spinner(`${message} %s`);
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    (spinner as any).succeed = function (text?: string): void {
        this.stop(true);
        console.log(chalk.green('✓') + ' ' + (text || message));
    };

    (spinner as any).fail = function (text?: string): void {
        this.stop(true);
        console.log(chalk.red('✗') + ' ' + (text || message));
    };
    return spinner as Spinner & { succeed: (text?: string) => void; fail: (text?: string) => void };
}

export async function getInput(message: string, defaultValue?: string, allowCancel: boolean = false): Promise<string | null> {
    try {
        const result = await input({
            message: allowCancel ? `${message} (type 'cancel' to go back)` : message,
            default: defaultValue
        });
        
        if (allowCancel && (result.toLowerCase() === 'cancel' || result.toLowerCase() === 'back')) {
            return null;
        }
        
        return result;
    } catch (error) {
        // If an error occurs (like Ctrl+C), treat it as cancel
        return null;
    }
}

export async function getMultilineInput(initialValue?: string): Promise<string> {
    console.log(
        chalk.yellow('Enter/paste your content. Press Ctrl+D (Unix) or Ctrl+Z (Windows) followed by Enter to finish:')
    );

    if (initialValue) {
        console.log(chalk.dim('\nCurrent content:'));
        console.log(initialValue);
        console.log(chalk.cyan('\nNew content:'));
    }
    return new Promise((resolve) => {
        let content = '';
        process.stdin.setRawMode!(false);
        process.stdin.resume();
        process.stdin.on('data', (chunk) => {
            content += chunk;
        });

        process.stdin.on('end', () => {
            process.stdin.setRawMode!(true);
            process.stdin.resume();
            resolve(content.trim());
        });
    });
}
