import path from 'path';

import fs from 'fs-extra';
import simpleGit from 'simple-git';
import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { getConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { formatRelativeTime } from '../../shared/utils/string-formatter';
import { cliConfig } from '../config/cli-config';
import {
    getRepoUrl,
    cleanupTempDir,
    cloneRepository,
    diffDirectories,
    logChanges,
    performSync,
    hasPendingChanges,
    getPendingChanges,
    createBranchAndPushChanges,
    clearPendingChanges
} from '../utils/sync-utils';

class SyncCommand extends BaseCommand {
    constructor() {
        super('sync', 'Sync prompts with the remote repository');
        this.option('-u, --url <url>', 'Set the remote repository URL')
            .option('--force', 'Force sync without confirmation')
            .option('--push', 'Push local changes to remote repository')
            .option('--list', 'List pending changes that need to be synced')
            .option('--branch <name>', 'Branch name for pushing changes (defaults to prompt/timestamp)')
            .action(this.execute.bind(this));
    }

    async execute(options: { url?: string; force?: boolean; push?: boolean; list?: boolean; branch?: string }): Promise<void> {
        try {
            // Check for --list flag to show pending changes
            if (options.list) {
                await this.listPendingChanges();
                return;
            }
            
            // Check for --push flag to push changes
            if (options.push) {
                await this.pushPendingChanges(options.branch);
                return;
            }
            
            // Default behavior: pull from remote
            const repoUrl = await getRepoUrl(options.url, this.getInput.bind(this));
            const git = simpleGit();
            const tempDir = path.join(cliConfig.TEMP_DIR, 'temp_repository');
            await cleanupTempDir(tempDir);
            await cloneRepository(git, repoUrl, tempDir);

            const config = getConfig();
            const prompts_dir = path.join(tempDir, 'prompts');
            const fragments_dir = path.join(tempDir, 'fragments');
            const changes = await diffDirectories(config.PROMPTS_DIR, prompts_dir);
            const fragmentChanges = await diffDirectories(config.FRAGMENTS_DIR, fragments_dir);

            if (changes.length === 0 && fragmentChanges.length === 0) {
                logger.info('No changes detected. Everything is up to date.');
                await fs.remove(tempDir);
                return;
            }

            logChanges(changes, 'Prompts');
            logChanges(fragmentChanges, 'Fragments');

            if (!options.force && !(await this.confirmSync())) {
                logger.info('Sync cancelled by user.');
                await fs.remove(tempDir);
                return;
            }

            await performSync(tempDir, changes, fragmentChanges);

            logger.info('Sync completed successfully!');
        } catch (error) {
            this.handleError(error, 'sync');
        } finally {
            if (!options.list && !options.push) {
                await this.pressKeyToContinue();
            }
        }
    }

    private async confirmSync(): Promise<boolean> {
        return this.confirmAction('Do you want to proceed with the sync?');
    }
    
    /**
     * List all pending changes that need to be synced
     */
    private async listPendingChanges(): Promise<void> {
        const hasChanges = await hasPendingChanges();
        if (!hasChanges) {
            console.log(chalk.green('\n✓ No pending changes to sync.'));
            console.log(chalk.gray('\nYour local repository is in sync with the latest changes.'));
            return;
        }
        
        const changes = await getPendingChanges();
        
        if (changes.length === 0) {
            console.log(chalk.green('\n✓ No pending changes to sync.'));
            console.log(chalk.gray('\nYour local repository is in sync with the latest changes.'));
            return;
        }
        
        console.log(chalk.bold('\nPending changes to sync:'));
        console.log('─'.repeat(100));
        
        // Sort changes by most recent first
        changes.forEach(change => {
            const timestamp = new Date(change.timestamp);
            const relativeTime = formatRelativeTime(timestamp);
            
            // Show title if available, directory otherwise
            const displayName = change.title ? 
                `${chalk.bold(change.title)} (${change.directory})` : 
                change.directory;
                
            console.log(
                `${change.change_type === 'add' ? chalk.green(change.change_type.padEnd(7)) : 
                   change.change_type === 'modify' ? chalk.yellow(change.change_type.padEnd(7)) : 
                   chalk.red(change.change_type.padEnd(7))} ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
            );
        });
        
        console.log('─'.repeat(100));
        console.log(chalk.cyan(`\nTotal: ${changes.length} change(s)`));
        console.log(chalk.italic('\nTo push these changes, run: prompt-library-cli sync --push'));
        
        // Ask if user wants to push changes now
        if (await this.confirmAction('Would you like to push these changes now?')) {
            await this.pushPendingChanges();
        }
    }
    
    /**
     * Push pending changes to remote repository
     */
    private async pushPendingChanges(branchName?: string): Promise<void> {
        const hasChanges = await hasPendingChanges();
        if (!hasChanges) {
            console.log(chalk.green('\n✓ No changes to push.'));
            console.log(chalk.gray('\nYour local repository is in sync with the latest changes.'));
            return;
        }
        
        const changes = await getPendingChanges();
        
        if (changes.length === 0) {
            console.log(chalk.green('\n✓ No changes to push.'));
            console.log(chalk.gray('\nYour local repository is in sync with the latest changes.'));
            return;
        }
        
        console.log(chalk.bold('\nChanges to push:'));
        console.log('─'.repeat(100));
        
        changes.forEach(change => {
            // Show title if available, directory otherwise
            const displayName = change.title ? 
                `${chalk.bold(change.title)} (${change.directory})` : 
                change.directory;
                
            console.log(
                `${change.change_type === 'add' ? chalk.green(change.change_type.padEnd(7)) : 
                   change.change_type === 'modify' ? chalk.yellow(change.change_type.padEnd(7)) : 
                   chalk.red(change.change_type.padEnd(7))} ${displayName}`
            );
        });
        
        // Get branch name
        const branch = branchName || `prompt/${Date.now()}`;
        console.log(chalk.cyan(`\nBranch: ${branch}`));
        
        // Confirm push
        if (!(await this.confirmAction('Push changes?'))) {
            console.log(chalk.yellow('Push cancelled.'));
            return;
        }
        
        try {
            console.log(chalk.cyan('\nPushing changes...'));
            await createBranchAndPushChanges(branch);
            await clearPendingChanges();
            console.log(chalk.green('\n✓ Changes pushed successfully.'));
            console.log(chalk.bold(`Created branch: ${branch}`));
            console.log('Please create a pull request on the repository to merge your changes.');
        } catch (error) {
            this.handleError(error, 'pushing changes');
        }
    }
    
    // Using shared formatRelativeTime from string-formatter.ts
}

export default new SyncCommand();
