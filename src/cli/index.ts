#!/usr/bin/env node
process.env.CLI_ENV = 'cli';

import { Separator } from '@inquirer/core';
import { input } from '@inquirer/prompts';
import select from '@inquirer/select';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';
import { Command } from 'commander';
import dotenv from 'dotenv';

dotenv.config();

import configCommand from './commands/config-command';
import envCommand from './commands/env-command';
import executeCommand from './commands/execute-command';
import flushCommand from './commands/flush-command';
import fragmentsCommand from './commands/fragments-command';
import { showMainMenu } from './commands/menu-command';
import modelCommand from './commands/model-command';
import promptsCommand from './commands/prompts-command';
import settingsCommand from './commands/settings-command';
import syncCommand from './commands/sync-command';
import { initDatabase } from './utils/database';

async function ensureApiKey(): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const CONFIG_DIR = path.join(os.homedir(), '.prompt-library-cli');
    const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
    let config: Record<string, any> = {
        MODEL_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = {
                ...config,
                ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
            };
        } catch (e) {
            console.error('Error reading config file:', e);
        }
    }

    const provider = config.MODEL_PROVIDER || 'anthropic';
    const validProvider = provider === 'anthropic' || provider === 'openai' ? provider : 'anthropic';
    const keyName = validProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    let apiKey = config[keyName] || process.env[keyName];

    if (!apiKey) {
        console.log(`${keyName} is not set.`);
        apiKey = await input({ message: `Please enter your ${validProvider} API key:` });

        config[keyName] = apiKey;

        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        process.env[keyName] = apiKey;
    }

    if (!config[keyName] && !process.env[keyName]) {
        throw new Error(`Failed to set ${keyName}`);
    }
}

async function simplifiedMenu(program: Command): Promise<void> {
    console.clear();

    try {
        const configModule = await import('../shared/config');
        const { getConfigValue } = configModule;
        const modelProvider = getConfigValue('MODEL_PROVIDER') || 'unknown';
        const modelName =
            getConfigValue(modelProvider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL') || 'unknown';
        console.log(chalk.bold(chalk.cyan(`🧠 Prompt Library CLI (DEV MODE)`)));
        console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProvider)} / ${chalk.cyan(modelName)}`);

        const choices = [
            new Separator(''),
            new Separator(chalk.bold.cyan('📚 MAIN MENU')),
            new Separator(''),
            { name: chalk.bold('Browse and run prompts'), value: 'prompts' },
            { name: 'Manage prompt fragments', value: 'fragments' },

            new Separator(''),
            new Separator(chalk.bold.cyan('⚙️ CONFIGURATION')),
            new Separator(''),
            { name: chalk.bold('Configure AI model settings'), value: 'model' },
            { name: 'Manage environment variables', value: 'env' },
            { name: 'Settings', value: 'settings' },

            new Separator(''),
            { name: chalk.red(chalk.bold('Exit')), value: 'exit' }
        ];
        const selectedCommand = await select({
            message: 'Select an action:',
            choices: choices
        });

        if (selectedCommand === 'exit') {
            console.log(chalk.yellow('Goodbye!'));
            return;
        }

        console.clear();

        const command = program.commands.find((cmd) => cmd.name() === selectedCommand);

        if (command) {
            try {
                await command.parseAsync(['node', 'script.js', selectedCommand]);
            } catch (error) {
                console.error('Error executing command:', error);
            }
        } else {
            console.log(chalk.red(`Command '${selectedCommand}' not found.`));
        }

        console.clear();
        await simplifiedMenu(program);
    } catch (error) {
        if (error && error.toString().includes('User force closed the prompt')) {
            console.log(chalk.yellow('\nExiting...'));
            return;
        }

        console.error('Error in menu:', error);
    }
}

function organizeCommandGroups(program: Command): void {
    program.configureHelp({
        sortSubcommands: false,
        subcommandTerm: (cmd) => chalk.green(cmd.name())
    });
}

async function main(): Promise<void> {
    const spinner = new Spinner('Initializing Prompt Library... %s');
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    try {
        await initDatabase();
        await ensureApiKey();
        spinner.stop(true);
    } catch (error) {
        spinner.stop(true);
        console.error(chalk.red('Initialization failed:'), error);
        process.exit(1);
    }

    const program = new Command();
    program
        .name('prompt-library-cli')
        .description('Interactive CLI for managing and executing AI prompts')
        .version('1.0.0')
        .addHelpText('before', chalk.bold(chalk.cyan('\n🧠 Prompt Library CLI\n')))
        .addHelpText(
            'after',
            `
Examples:
  $ prompt-library-cli                     Start interactive menu
  $ prompt-library-cli execute -p 74       Execute prompt by ID
  $ prompt-library-cli prompts --list      List all available prompts
  $ prompt-library-cli model               Configure AI model settings
        `
        )
        .option('-e, --execute <id_or_name>', 'Execute a prompt by ID or name')
        .option('-l, --list', 'List all available prompts')
        .option('-s, --search <keyword>', 'Search prompts by keyword')
        .action(async (options) => {
            if (options.execute) {
                console.clear();
                await executeCommand.parseAsync(['node', 'script.js', '-p', options.execute]);
            } else if (options.list) {
                console.clear();
                await promptsCommand.parseAsync(['node', 'script.js', '--list']);
            } else if (options.search) {
                console.clear();
                await promptsCommand.parseAsync(['node', 'script.js', '--search', options.search]);
            } else if (process.argv.length <= 2) {
                if (process.env.NODE_ENV === 'production') {
                    await showMainMenu(program);
                } else {
                    await simplifiedMenu(program);
                }
            }
        });

    const commands = [
        configCommand,
        envCommand,
        executeCommand,
        flushCommand,
        fragmentsCommand,
        modelCommand,
        promptsCommand,
        settingsCommand,
        syncCommand
    ];
    commands.forEach((cmd) => program.addCommand(cmd));
    organizeCommandGroups(program);

    await program.parseAsync(process.argv);
}

main().catch((error) => {
    if (error && error.toString().includes('User force closed the prompt')) {
        console.log(chalk.yellow('\nExiting...'));
        process.exit(0);
    }

    console.error('An error occurred:', error);
    process.exit(1);
});
