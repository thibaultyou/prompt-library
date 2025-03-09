import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

interface SelectConfig<_T> {
    message: string;
    choices: any[];
    pageSize?: number;
    loop?: boolean;
    theme?: any;
}

export async function selectWithHeaders<T>(config: SelectConfig<T>): Promise<T> {
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
                disabled: ''
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

export function printSectionHeader(title: string): void {
    console.log('\n' + chalk.bold(chalk.cyan(`📚 ${title}`)));
    console.log('─'.repeat(80));
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
