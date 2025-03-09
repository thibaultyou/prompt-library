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
import repositoryCommand from './commands/repository-command';
import settingsCommand from './commands/settings-command';
import setupCommand from './commands/setup-command';
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
        
        // Get model info
        const modelProvider = getConfigValue('MODEL_PROVIDER') || 'unknown';
        const modelName =
            getConfigValue(modelProvider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL') || 'unknown';
        
        // Get repository info
        const repoUrl = getConfigValue('REMOTE_REPOSITORY') || 'not configured';
        const shortRepoUrl = repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
        
        // Get sync status using library repository 
        const { hasLibraryRepositoryChanges, getLibraryRepositoryChanges, isLibraryRepositorySetup } = 
            await import('./utils/library-repository');
        
        // Check if library is set up first
        const isSetUp = await isLibraryRepositorySetup();
        const pendingChanges = isSetUp ? await hasLibraryRepositoryChanges() : false;
        
        // Get detailed status from git if possible
        let syncStatus = '';
        let pendingCount = 0;
        
        if (!isSetUp) {
            // If library is not set up, show that setup is needed
            syncStatus = chalk.yellow('⚠️ setup needed');
        } else {
            try {
                // Get repository changes
                const changes = await getLibraryRepositoryChanges();
                pendingCount = changes.length;
                
                if (pendingCount > 0) {
                    syncStatus = chalk.yellow(`⚠️  ${pendingCount} pending change${pendingCount > 1 ? 's' : ''}`);
                } else {
                    syncStatus = chalk.green('✓ in sync');
                }
            } catch (error) {
                // Fall back to simple boolean status if detailed check fails
                syncStatus = pendingChanges ? 
                    chalk.yellow(`⚠️  Pending changes`) : 
                    chalk.green('✓ in sync');
            }
        }
            
        // Print header
        console.log(chalk.bold(chalk.cyan(`🧠 Prompt Library CLI (DEV MODE)`)));
        console.log(`${chalk.gray('Using:')} ${chalk.cyan(modelProvider)} / ${chalk.cyan(modelName)}`);
        console.log(`${chalk.gray('Remote:')} ${chalk.cyan(shortRepoUrl)} ${chalk.gray('Status:')} ${syncStatus}`);

        // Check if there are any prompts
        const fs = await import('fs-extra');
        
        // Check if there are any prompts in the system
        const promptsDir = await fs.readdir(configModule.getConfigValue('PROMPTS_DIR'));
            
        const choices = [
            new Separator(''),
            new Separator(chalk.bold.cyan('📚 PROMPTS & CONTENT')),
            new Separator(''),
            { name: chalk.bold('Browse and run prompts'), value: 'execute' },
            { name: chalk.bold('Create a new prompt'), value: 'prompts create' },
            { name: chalk.bold('Edit an existing prompt'), value: 'prompts edit' },
            
            new Separator(''),
            new Separator(chalk.bold.cyan('🧩 COMPONENTS')),
            new Separator(''),
            { name: chalk.bold('Manage prompt fragments'), value: 'fragments' },
            { name: chalk.bold('Manage environment variables'), value: 'env' },
            
            new Separator(''),
            new Separator(chalk.bold.cyan('🔄 REPOSITORY')),
            new Separator(''),
            { name: !pendingChanges && promptsDir.length === 0 ? 
              chalk.bold(chalk.green('Pull from remote repository')) : 
              chalk.bold('Pull from remote repository'), 
              value: 'sync' },
            pendingChanges ? 
              { name: chalk.bold(chalk.yellow(`View pending changes (${pendingCount})`)), value: 'sync --list' } : 
              { name: chalk.bold('View pending changes'), value: 'sync --list' },
            pendingChanges ? 
              { name: chalk.bold(chalk.yellow('Push changes to remote')), value: 'sync --push' } : 
              { name: chalk.bold('Push changes to remote'), value: 'sync --push' },

            new Separator(''),
            new Separator(chalk.bold.cyan('⚙️ SETTINGS')),
            new Separator(''),
            { name: chalk.bold('Configure AI model'), value: 'model' },
            { name: chalk.bold('Configure CLI settings'), value: 'config' },
            { name: chalk.bold('Reset/flush all data'), value: 'flush' },

            new Separator(''),
            { name: chalk.red(chalk.bold('Exit')), value: 'exit' }
        ];
        const selectedCommand = await select({
            message: 'Select an action:',
            choices: choices,
            pageSize: 20  // Increase page size to show more options at once
        });

        if (selectedCommand === 'exit') {
            console.log(chalk.yellow('Goodbye!'));
            return;
        }

        console.clear();

        // Handle subcommands (e.g., 'prompts create')
        const parts = selectedCommand.split(' ');
        const mainCommand = parts[0];
        const subCommand = parts.length > 1 ? parts[1] : null;
        
        // If we have a subcommand, construct the proper command array
        if (subCommand) {
            console.clear();
            try {
                if (mainCommand === 'prompts') {
                    // Handle prompts subcommands directly
                    if (subCommand === 'create') {
                        await program.parseAsync(['node', 'script.js', 'prompts', 'create']);
                    } else if (subCommand === 'edit') {
                        await program.parseAsync(['node', 'script.js', 'prompts', 'edit']);
                    }
                    console.clear();
                    await simplifiedMenu(program);
                    return;
                } else if (mainCommand === 'sync') {
                    // Handle sync subcommands
                    if (subCommand === '--list') {
                        await program.parseAsync(['node', 'script.js', 'sync', '--list']);
                    } else if (subCommand === '--push') {
                        await program.parseAsync(['node', 'script.js', 'sync', '--push']);
                    }
                    console.clear();
                    await simplifiedMenu(program);
                    return;
                } else if (mainCommand === 'fragments') {
                    // For future fragment subcommands
                    // if (subCommand === 'create') {
                    //     await program.parseAsync(['node', 'script.js', 'fragments', 'create']);
                    // } else if (subCommand === 'edit') {
                    //     await program.parseAsync(['node', 'script.js', 'fragments', 'edit']);
                    // }
                    console.clear();
                    await simplifiedMenu(program);
                    return;
                }
            } catch (error) {
                console.error('Error executing subcommand:', error);
                await simplifiedMenu(program);
                return;
            }
        }
        
        const command = program.commands.find((cmd) => cmd.name() === mainCommand);

        if (command) {
            try {
                await command.parseAsync(['node', 'script.js', mainCommand]);
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
  $ prompt-library-cli setup               Set up prompt library repository
  $ prompt-library-cli execute -p 74       Execute prompt by ID
  $ prompt-library-cli prompts --list      List all available prompts
  $ prompt-library-cli model               Configure AI model settings
        `
        )
        .option('-e, --execute <id_or_name>', 'Execute a prompt by ID or name')
        .option('-l, --list', 'List all available prompts')
        .option('-s, --search <keyword>', 'Search prompts by keyword')
        .action(async (options) => {
            // Check if library repository is set up
            const { isLibraryRepositorySetup } = await import('./utils/library-repository');
            const repoSetup = await isLibraryRepositorySetup();
            
            // For specific commands, proceed regardless of repository status
            if (options.execute) {
                console.clear();
                await executeCommand.parseAsync(['node', 'script.js', '-p', options.execute]);
                return;
            } else if (options.list) {
                console.clear();
                await promptsCommand.parseAsync(['node', 'script.js', '--list']);
                return;
            } else if (options.search) {
                console.clear();
                await promptsCommand.parseAsync(['node', 'script.js', '--search', options.search]);
                return;
            } 
            
            // For top-level command (menu), check if repository needs to be set up
            if (process.argv.length <= 2) {
                // If repository is not set up, suggest setup
                if (!repoSetup) {
                    console.clear();
                    console.log(chalk.yellow('⚠️  Prompt Library repository not found'));
                    console.log(chalk.cyan('Run setup to create a dedicated repository for your prompts:'));
                    console.log(chalk.bold('\n  prompt-library-cli setup\n'));
                    
                    const { confirm } = await import('@inquirer/prompts');
                    const shouldSetup = await confirm({ 
                        message: 'Would you like to run setup now?',
                        default: true
                    });
                    
                    if (shouldSetup) {
                        console.clear();
                        await setupCommand.parseAsync(['node', 'script.js']);
                        
                        // After setup, check again and continue to menu if successful
                        if (await isLibraryRepositorySetup()) {
                            console.log(chalk.green('\n✅ Setup completed successfully!'));
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else {
                            console.log(chalk.red('\n❌ Setup failed. Please try again or check the logs.'));
                            return;
                        }
                    } else {
                        return;
                    }
                }
                
                // Show appropriate menu
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
        repositoryCommand,
        settingsCommand,
        setupCommand,
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
