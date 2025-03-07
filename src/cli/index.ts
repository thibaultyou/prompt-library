#!/usr/bin/env node
// IMPORTANT: This must be set BEFORE all imports to avoid resolution issues
// Setting this in a separate file won't help - we need it before ANY imports to prevent circular dependencies
process.env.CLI_ENV = 'cli';

import { input } from '@inquirer/prompts';
import select from '@inquirer/select';
import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Import using commonjs syntax to avoid circular reference issues in ts-node
// We'll use dynamic require at runtime instead of static imports
// for getConfigValue and setConfig to avoid circular dependency in dev mode
// import { getConfigValue, setConfig } from '../shared/config';
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
    // Load manually to avoid circular dependencies in ts-node
    // Using dynamic imports instead of requires
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    // Load config directly for the bootstrap phase
    const CONFIG_DIR = path.join(os.homedir(), '.prompt-library-cli');
    const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
    let config: Record<string, any> = {
        MODEL_PROVIDER: 'anthropic', // Default
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };

    // Try to load config from file
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

    // Get values from loaded config
    const provider = config.MODEL_PROVIDER || 'anthropic';
    // Make sure provider is one of the valid values
    const validProvider = provider === 'anthropic' || provider === 'openai' ? provider : 'anthropic';
    const keyName = validProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    let apiKey = config[keyName] || process.env[keyName];

    if (!apiKey) {
        console.log(`${keyName} is not set.`);
        apiKey = await input({ message: `Please enter your ${validProvider} API key:` });

        // Update config
        config[keyName] = apiKey;

        // Ensure directory exists
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        // Save config
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        // Set in environment for current session
        process.env[keyName] = apiKey;
    }

    if (!config[keyName] && !process.env[keyName]) {
        throw new Error(`Failed to set ${keyName}`);
    }
}

async function simplifiedMenu(program: Command): Promise<void> {
    // This is a simplified menu for development mode to work around ts-node circular dependencies
    console.log(chalk.bold(chalk.cyan('Welcome to the Prompt Library (DEV MODE)!')));

    const choices = [
        { name: 'Browse and run prompts', value: 'prompts' },
        { name: 'Manage prompt fragments', value: 'fragments' },
        { name: 'Configure AI model settings', value: 'model' },
        { name: 'Manage environment variables', value: 'env' },
        { name: 'Settings', value: 'settings' },
        { name: 'Exit', value: 'exit' }
    ];

    try {
        // Use select for a better interactive experience
        const selectedCommand = await select({
            message: 'Select an action:',
            choices: choices
        });

        if (selectedCommand === 'exit') {
            console.log(chalk.yellow('Goodbye!'));
            return;
        }

        // Run the selected command
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

        // Return to menu after command execution
        await simplifiedMenu(program);
    } catch (error) {
        // Handle user interruption (Ctrl+C)
        if (error && error.toString().includes('User force closed the prompt')) {
            console.log(chalk.yellow('\nExiting...'));
            return;
        }

        console.error('Error in menu:', error);
    }
}

async function main(): Promise<void> {
    await initDatabase();
    await ensureApiKey();

    const program = new Command();
    program.name('prompt-library-cli').description('CLI tool for managing and executing AI prompts').version('1.0.0');

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

    if (process.argv.length > 2) {
        await program.parseAsync(process.argv);
    } else {
        if (process.env.NODE_ENV === 'production') {
            // Use the regular menu in production mode
            await showMainMenu(program);
        } else {
            // Use the simplified menu in development mode
            await simplifiedMenu(program);
        }
    }
}

main().catch((error) => {
    // Handle user interruption (Ctrl+C) gracefully
    if (error && error.toString().includes('User force closed the prompt')) {
        console.log(chalk.yellow('\nExiting...'));
        process.exit(0);
    }

    console.error('An error occurred:', error);
    process.exit(1);
});
