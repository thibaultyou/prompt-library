#!/usr/bin/env node
process.env.PROMPT_LIBRARY_ENV = 'cli';

import { input } from '@inquirer/prompts';
import { Command } from 'commander';
import dotenv from 'dotenv';

import configCommand from './commands/config.command';
import envCommand from './commands/env.command';
import executeCommand from './commands/execute.command';
import flushCommand from './commands/flush.command';
import fragmentsCommand from './commands/fragments.command';
import { showMainMenu } from './commands/menu.command';
import promptsCommand from './commands/prompts.command';
import settingsCommand from './commands/settings.command';
import syncCommand from './commands/sync.command';
import { initDatabase } from './utils/database.util';
import { getConfig, setConfig } from '../shared/config';

dotenv.config();

async function ensureApiKey(): Promise<void> {
    const config = getConfig();

    if (!config.ANTHROPIC_API_KEY) {
        console.log('ANTHROPIC_API_KEY is not set.');
        const apiKey = await input({ message: 'Please enter your Anthropic API key:' });
        setConfig('ANTHROPIC_API_KEY', apiKey);
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
        promptsCommand,
        settingsCommand,
        syncCommand
    ];
    commands.forEach((cmd) => program.addCommand(cmd));

    if (process.argv.length > 2) {
        await program.parseAsync(process.argv);
    } else {
        await showMainMenu(program);
    }
}

main().catch((error) => {
    console.error('An error occurred:', error);
    process.exit(1);
});
