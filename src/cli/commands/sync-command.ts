import path from 'path';

import { checkbox, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import simpleGit from 'simple-git';

import { BaseCommand, LIBRARY_FRAGMENTS_DIR, LIBRARY_PROMPTS_DIR } from './base-command';
import { getConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { formatRelativeTime } from '../../shared/utils/string-formatter';
import { cliConfig } from '../config/cli-config';
import { syncPromptsWithDatabase } from '../utils/database';
import {
    getFormattedDiff,
    getLibraryRepositoryChanges,
    hasLibraryRepositoryChanges,
    isLibraryRepositorySetup,
    pushChangesToRemote
} from '../utils/library-repository';
import {
    getRepoUrl,
    cleanupTempDir,
    cloneRepository,
    diffDirectories,
    logChanges,
    performSync,
    hasPendingChanges,
    getPendingChanges,
    clearPendingChanges
} from '../utils/sync-utils';
import { showSpinner } from '../utils/ui-components';

class SyncCommand extends BaseCommand {
    constructor() {
        super('sync', 'Sync prompts with the remote repository');
        this.option('-u, --url <url>', 'Set the remote repository URL')
            .option('--force', 'Force sync without confirmation')
            .option('--push', 'Push local changes to remote repository')
            .option('--list', 'List pending changes that need to be synced')
            .option('--reset', 'Reset/discard local changes')
            .option('--branch <n>', 'Branch name for pushing changes (defaults to prompt/timestamp)')
            .action(this.execute.bind(this));
    }

    async execute(options: {
        url?: string;
        force?: boolean;
        push?: boolean;
        list?: boolean;
        reset?: boolean;
        branch?: string;
    }): Promise<void> {
        try {
            if (options.list) {
                await this.listPendingChanges();
                return;
            }

            if (options.push) {
                await this.pushPendingChanges(options.branch);
                return;
            }

            if (options.reset) {
                await this.resetLocalChanges();
                return;
            }

            const isSetUp = await isLibraryRepositorySetup();

            if (!isSetUp) {
                console.log(chalk.yellow('⚠️ Prompt library repository is not set up.'));
                console.log(chalk.cyan('Run "prompt-library-cli setup" first to set up the repository.'));
                return;
            }

            const repoUrl = await getRepoUrl(options.url, this.getInput.bind(this));
            const git = simpleGit();
            const appConfig = getConfig();
            const tempDir = path.join(cliConfig.TEMP_DIR, 'temp_repository');
            await cleanupTempDir(tempDir);
            await cloneRepository(git, repoUrl, tempDir);

            const cliPromptsDir = appConfig.PROMPTS_DIR;
            const cliFragmentsDir = appConfig.FRAGMENTS_DIR;
            const remotePromptsDir = path.join(tempDir, 'prompts');
            const remoteFragmentsDir = path.join(tempDir, 'fragments');
            const localChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);
            const localFragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);
            const convertedLocalChanges = localChanges.map((change) => ({
                ...change,
                type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified',
                source: 'local'
            }));
            const convertedLocalFragmentChanges = localFragmentChanges.map((change) => ({
                ...change,
                type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified',
                source: 'local'
            }));

            if (convertedLocalChanges.length > 0 || convertedLocalFragmentChanges.length > 0) {
                console.log(
                    chalk.yellow('\n⚠️ You have local changes that need to be pushed to the repository first.')
                );
                console.log(chalk.cyan('Please run: prompt-library-cli sync --push\n'));

                if (!(await this.confirmAction('Do you want to continue with remote sync anyway?'))) {
                    logger.info('Sync cancelled by user due to local changes.');
                    await fs.remove(tempDir);
                    return;
                }
            }

            const repoChanges = await diffDirectories(LIBRARY_PROMPTS_DIR, remotePromptsDir);
            const repoFragmentChanges = await diffDirectories(LIBRARY_FRAGMENTS_DIR, remoteFragmentsDir);
            const cliChanges = await diffDirectories(cliPromptsDir, remotePromptsDir);
            const cliFragmentChanges = await diffDirectories(cliFragmentsDir, remoteFragmentsDir);
            const uniquePaths = new Set<string>();
            const allPromptChanges = [...repoChanges, ...cliChanges].filter((change) => {
                const key = change.path;

                if (uniquePaths.has(key)) return false;

                uniquePaths.add(key);
                return true;
            });
            uniquePaths.clear();

            const allFragmentChanges = [...repoFragmentChanges, ...cliFragmentChanges].filter((change) => {
                const key = change.path;

                if (uniquePaths.has(key)) return false;

                uniquePaths.add(key);
                return true;
            });

            if (allPromptChanges.length === 0 && allFragmentChanges.length === 0) {
                logger.info('No changes detected. Everything is up to date.');
                await fs.remove(tempDir);
                return;
            }

            logChanges(allPromptChanges, 'Prompts');
            logChanges(allFragmentChanges, 'Fragments');

            if (!options.force && !(await this.confirmSync())) {
                logger.info('Sync cancelled by user.');
                await fs.remove(tempDir);
                return;
            }

            await performSync(tempDir, allPromptChanges, allFragmentChanges);

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
        console.log(chalk.cyan('\nReview the changes above carefully before proceeding.'));
        console.log(chalk.yellow('These changes will be applied to your local prompt library.'));

        console.log('');
        return await confirm({
            message: 'Do you want to proceed with the sync?',
            default: false
        });
    }

    private async listPendingChanges(): Promise<void> {
        console.clear();

        const isSetUp = await isLibraryRepositorySetup();

        if (!isSetUp) {
            console.log(chalk.yellow('⚠️ Prompt library repository is not set up.'));
            console.log(chalk.cyan('Run "prompt-library-cli setup" first to set up the repository.'));
            return;
        }

        try {
            console.log(chalk.bold(chalk.cyan('\n📋 Pending Changes')));
            console.log('───────────────────────────────────────────────────────────');

            const config = getConfig();
            const cliPromptsDir = config.PROMPTS_DIR;
            const cliFragmentsDir = config.FRAGMENTS_DIR;
            const promptChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);
            const fragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);
            const convertedPromptChanges = promptChanges.map((change) => ({
                ...change,
                type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified'
            }));
            const convertedFragmentChanges = fragmentChanges.map((change) => ({
                ...change,
                type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified'
            }));

            if (convertedPromptChanges.length === 0 && convertedFragmentChanges.length === 0) {
                console.log(chalk.green('\n✓ No pending changes to sync.'));
                console.log(chalk.gray('\nYour local repository is in sync with the latest changes.'));
                return;
            }

            if (convertedPromptChanges.length > 0) {
                console.log(chalk.bold('\nPrompt changes:'));
                console.log('─'.repeat(100));

                for (const change of convertedPromptChanges) {
                    const pathParts = change.path.split(path.sep);
                    const directory = pathParts[0];
                    const displayName = `Prompt: ${directory}`;
                    const changeTime = new Date();
                    const relativeTime = formatRelativeTime(changeTime);
                    console.log(
                        `${
                            change.type === 'added'
                                ? chalk.green('add'.padEnd(7))
                                : change.type === 'modified'
                                  ? chalk.yellow('modify'.padEnd(7))
                                  : chalk.red('delete'.padEnd(7))
                        } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                    );
                }
            }

            if (convertedFragmentChanges.length > 0) {
                console.log(chalk.bold('\nFragment changes:'));
                console.log('─'.repeat(100));

                for (const change of convertedFragmentChanges) {
                    const pathParts = change.path.split(path.sep);
                    let category = '';
                    let name = '';

                    if (pathParts.length >= 2) {
                        category = pathParts[0];
                        name = pathParts[1].replace(/\.md$/, '');
                    } else if (pathParts.length === 1) {
                        name = pathParts[0].replace(/\.md$/, '');
                    }

                    const displayName = `Fragment: ${category}/${name}`;
                    const changeTime = new Date();
                    const relativeTime = formatRelativeTime(changeTime);
                    console.log(
                        `${
                            change.type === 'added'
                                ? chalk.green('add'.padEnd(7))
                                : change.type === 'modified'
                                  ? chalk.yellow('modify'.padEnd(7))
                                  : chalk.red('delete'.padEnd(7))
                        } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                    );
                }
            }

            console.log('─'.repeat(100));
            console.log(
                chalk.cyan(`\nTotal: ${convertedPromptChanges.length + convertedFragmentChanges.length} change(s)`)
            );

            console.log('\nAvailable actions:');
            console.log(chalk.cyan('• To push these changes: prompt-library-cli sync --push'));
            console.log(chalk.cyan('• To reset changes:     prompt-library-cli sync --reset'));
            console.log('');

            const action = await select({
                message: 'What would you like to do?',
                choices: [
                    { name: 'Push changes to remote repository', value: 'push' },
                    { name: 'Reset/discard changes', value: 'reset' },
                    { name: 'Return to menu', value: 'back' }
                ]
            });

            if (action === 'push') {
                console.clear();
                await this.pushPendingChanges();
            } else if (action === 'reset') {
                console.clear();
                await this.resetLocalChanges();
            }
        } catch (error) {
            this.handleError(error, 'listing pending changes');
            console.log(chalk.red('\nFailed to list pending changes. See logs for details.'));

            const hasChanges = await hasPendingChanges();

            if (hasChanges) {
                const changes = await getPendingChanges();

                if (changes.length > 0) {
                    console.log(chalk.yellow('\nDetected pending changes using fallback method:'));

                    for (const change of changes) {
                        console.log(`- ${change.title || change.directory} (${change.change_type})`);
                    }
                }
            }
        } finally {
            await this.pressKeyToContinue();
        }
    }

    private async resetLocalChanges(): Promise<void> {
        console.clear();
        console.log(chalk.bold(chalk.cyan('\n🔄 Reset/Discard Local Changes')));
        console.log('───────────────────────────────────────────────────────────');

        const isSetUp = await isLibraryRepositorySetup();

        if (!isSetUp) {
            console.log(chalk.yellow('⚠️ Prompt library repository is not set up.'));
            console.log(chalk.cyan('Run "prompt-library-cli setup" first to set up the repository.'));
            return;
        }

        const appConfig = getConfig();
        const cliPromptsDir = appConfig.PROMPTS_DIR;
        const cliFragmentsDir = appConfig.FRAGMENTS_DIR;
        const promptChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);
        const fragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);
        const convertedPromptChanges = promptChanges.map((change) => ({
            ...change,
            type: change.type === 'deleted' ? 'Delete' : change.type === 'modified' ? 'Restore' : 'Add',
            path: change.path,
            originalType: change.type
        }));
        const convertedFragmentChanges = fragmentChanges.map((change) => ({
            ...change,
            type: change.type === 'deleted' ? 'Delete' : change.type === 'modified' ? 'Restore' : 'Add',
            path: change.path,
            originalType: change.type
        }));

        if (convertedPromptChanges.length === 0 && convertedFragmentChanges.length === 0) {
            console.log(chalk.green('\n✓ No changes to reset. Everything is already in sync.'));
            return;
        }

        if (convertedPromptChanges.length > 0) {
            console.log(chalk.bold('\nPrompt changes that can be reset:'));
            console.log('─'.repeat(100));

            for (const change of convertedPromptChanges) {
                const pathParts = change.path.split(path.sep);
                const directory = pathParts[0];
                const coloredOp =
                    change.type === 'Delete'
                        ? chalk.red(change.type.padEnd(8))
                        : change.type === 'Restore'
                          ? chalk.yellow(change.type.padEnd(8))
                          : chalk.green(change.type.padEnd(8));
                console.log(`[ ] ${coloredOp} ${directory}`);
            }

            console.log('─'.repeat(100));
        }

        if (convertedFragmentChanges.length > 0) {
            console.log(chalk.bold('\nFragment changes that can be reset:'));
            console.log('─'.repeat(100));

            for (const change of convertedFragmentChanges) {
                const pathParts = change.path.split(path.sep);
                let category = '';
                let name = '';

                if (pathParts.length >= 2) {
                    category = pathParts[0];
                    name = pathParts[1].replace(/\.md$/, '');
                } else if (pathParts.length === 1) {
                    name = pathParts[0].replace(/\.md$/, '');
                }

                const displayName = `${category}/${name}`;
                const coloredOp =
                    change.type === 'Delete'
                        ? chalk.red(change.type.padEnd(8))
                        : change.type === 'Restore'
                          ? chalk.yellow(change.type.padEnd(8))
                          : chalk.green(change.type.padEnd(8));
                console.log(`[ ] ${coloredOp} ${displayName}`);
            }

            console.log('─'.repeat(100));
        }

        const resetAction = await select({
            message: 'How would you like to reset changes?',
            choices: [
                { name: 'Reset all changes', value: 'all' },
                { name: 'Select specific changes to reset', value: 'select' },
                { name: 'Cancel reset operation', value: 'cancel' }
            ]
        });

        if (resetAction === 'cancel') {
            console.log(chalk.yellow('\nReset operation cancelled.'));
            return;
        }

        let changesToReset: { type: 'prompt' | 'fragment'; path: string; changeType: string }[] = [];

        if (resetAction === 'all') {
            if (convertedPromptChanges.length > 0) {
                for (const change of convertedPromptChanges) {
                    const pathParts = change.path.split(path.sep);
                    const directory = pathParts[0];
                    changesToReset.push({
                        type: 'prompt',
                        path: directory,
                        changeType: change.originalType
                    });
                }
            }

            if (convertedFragmentChanges.length > 0) {
                for (const change of convertedFragmentChanges) {
                    const pathParts = change.path.split(path.sep);
                    let fullPath = '';

                    if (pathParts.length >= 2) {
                        fullPath = `${pathParts[0]}/${pathParts[1].replace(/\.md$/, '')}`;
                    } else if (pathParts.length === 1) {
                        fullPath = pathParts[0].replace(/\.md$/, '');
                    }

                    changesToReset.push({
                        type: 'fragment',
                        path: fullPath,
                        changeType: change.originalType
                    });
                }
            }
        } else if (resetAction === 'select') {
            const promptChoices = convertedPromptChanges.map((change) => {
                const pathParts = change.path.split(path.sep);
                const directory = pathParts[0];
                return {
                    name: `${change.type} Prompt: ${directory}`,
                    value: {
                        type: 'prompt' as const,
                        path: directory,
                        changeType: change.originalType
                    }
                };
            });
            const fragmentChoices = convertedFragmentChanges.map((change) => {
                const pathParts = change.path.split(path.sep);
                let category = '';
                let name = '';
                let fullPath = '';

                if (pathParts.length >= 2) {
                    category = pathParts[0];
                    name = pathParts[1].replace(/\.md$/, '');
                    fullPath = `${category}/${name}`;
                } else if (pathParts.length === 1) {
                    name = pathParts[0].replace(/\.md$/, '');
                    fullPath = name;
                }
                return {
                    name: `${change.type} Fragment: ${fullPath}`,
                    value: {
                        type: 'fragment' as const,
                        path: fullPath,
                        changeType: change.originalType
                    }
                };
            });
            const allChoices = [...promptChoices, ...fragmentChoices];

            if (allChoices.length > 0) {
                changesToReset = await checkbox({
                    message: 'Select changes to reset (use space to select/unselect)',
                    choices: allChoices as any
                });
            }
        }

        if (changesToReset.length === 0) {
            console.log(chalk.yellow('\nNo changes selected for reset. Operation cancelled.'));
            return;
        }

        const confirmReset = await confirm({
            message: `Are you sure you want to reset ${changesToReset.length} change(s)? This cannot be undone.`,
            default: false
        });

        if (!confirmReset) {
            console.log(chalk.yellow('\nReset operation cancelled.'));
            return;
        }

        console.log(chalk.cyan('\nResetting selected changes...'));
        const spinner = showSpinner('Processing reset operations...');

        try {
            let successCount = 0;
            let failCount = 0;

            for (const change of changesToReset) {
                try {
                    if (change.type === 'prompt') {
                        const srcPath = path.join(LIBRARY_PROMPTS_DIR, change.path);
                        const destPath = path.join(cliPromptsDir, change.path);

                        if (change.changeType === 'added') {
                            if (await fs.pathExists(destPath)) {
                                await fs.remove(destPath);
                            }
                        } else if (change.changeType === 'deleted') {
                            if (await fs.pathExists(srcPath)) {
                                await fs.ensureDir(path.dirname(destPath));
                                await fs.copy(srcPath, destPath, { overwrite: true });
                            }
                        } else {
                            if (await fs.pathExists(srcPath)) {
                                await fs.ensureDir(path.dirname(destPath));
                                await fs.copy(srcPath, destPath, { overwrite: true });
                            }
                        }

                        successCount++;
                    } else if (change.type === 'fragment') {
                        const [category, name] = change.path.split('/');
                        let srcPath: string;
                        let destPath: string;

                        if (name) {
                            srcPath = path.join(LIBRARY_FRAGMENTS_DIR, category, `${name}.md`);
                            destPath = path.join(cliFragmentsDir, category, `${name}.md`);
                        } else {
                            srcPath = path.join(LIBRARY_FRAGMENTS_DIR, `${category}.md`);
                            destPath = path.join(cliFragmentsDir, `${category}.md`);
                        }

                        if (change.changeType === 'deleted') {
                            if (!name) {
                                const categoryDir = path.join(cliFragmentsDir, category);

                                if (await fs.pathExists(categoryDir)) {
                                    await fs.remove(categoryDir);
                                    logger.info(`Removed entire fragment category directory: ${category}`);
                                    console.log(chalk.cyan(`Removed entire fragment category directory: ${category}`));
                                }
                            } else if (await fs.pathExists(destPath)) {
                                await fs.remove(destPath);

                                try {
                                    const categoryDir = path.dirname(destPath);
                                    const remainingFiles = await fs.readdir(categoryDir);

                                    if (remainingFiles.length === 0) {
                                        await fs.remove(categoryDir);
                                        logger.info(`Removed empty category directory: ${category}`);
                                    }
                                } catch (error) {
                                    logger.warn(`Could not check/remove empty category: ${error}`);
                                }
                            }
                        } else if (change.changeType === 'added' || change.changeType === 'modified') {
                            if (await fs.pathExists(srcPath)) {
                                await fs.ensureDir(path.dirname(destPath));
                                await fs.copy(srcPath, destPath, { overwrite: true });
                            }
                        }

                        successCount++;
                    }
                } catch (changeError) {
                    logger.error(`Failed to reset change: ${change.type} ${change.path}`, changeError);
                    failCount++;
                }
            }

            spinner.setSpinnerTitle('Updating database...');
            await syncPromptsWithDatabase();

            spinner.setSpinnerTitle('Clearing pending changes...');
            await clearPendingChanges();

            spinner.stop(true);

            if (failCount === 0) {
                console.log(chalk.green(`\n✓ Successfully reset ${successCount} change(s).`));
            } else {
                console.log(chalk.yellow(`\n✓ Reset ${successCount} change(s), but ${failCount} change(s) failed.`));
                console.log(chalk.gray('See logs for details about failed resets.'));
            }
        } catch (error) {
            spinner.fail('Error during reset operation');
            this.handleError(error, 'resetting changes');
        }
    }

    private async pushPendingChanges(branchName?: string): Promise<void> {
        console.clear();
        console.log(chalk.bold(chalk.cyan('\n📤 Push Changes to Remote Repository')));
        console.log('───────────────────────────────────────────────────────────');

        const isSetUp = await isLibraryRepositorySetup();

        if (!isSetUp) {
            console.log(chalk.yellow('⚠️ Prompt library repository is not set up.'));
            console.log(chalk.cyan('Run "prompt-library-cli setup" first to set up the repository.'));
            return;
        }

        const appConfig = getConfig();
        const cliPromptsDir = appConfig.PROMPTS_DIR;
        const cliFragmentsDir = appConfig.FRAGMENTS_DIR;
        const promptChanges = await diffDirectories(cliPromptsDir, LIBRARY_PROMPTS_DIR);
        const fragmentChanges = await diffDirectories(cliFragmentsDir, LIBRARY_FRAGMENTS_DIR);
        const convertedPromptChanges = promptChanges.map((change) => ({
            ...change,
            type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified'
        }));
        const convertedFragmentChanges = fragmentChanges.map((change) => ({
            ...change,
            type: change.type === 'deleted' ? 'added' : change.type === 'added' ? 'deleted' : 'modified'
        }));
        const hasGitChanges = await hasLibraryRepositoryChanges();

        if (!hasGitChanges && promptChanges.length === 0 && fragmentChanges.length === 0) {
            console.log(chalk.green('\n✓ No changes to push.'));
            console.log(chalk.gray('\nYour repository is in sync with the latest changes.'));
            return;
        }

        if (promptChanges.length > 0 || fragmentChanges.length > 0) {
            console.log(
                chalk.yellow(
                    '\n⚠️ Found changes in your CLI directory that need to be synced to the git repository first.'
                )
            );

            if (convertedPromptChanges.length > 0) {
                console.log(chalk.bold('\nPrompt changes:'));
                console.log('─'.repeat(100));

                for (const change of convertedPromptChanges) {
                    const pathParts = change.path.split(path.sep);
                    const directory = pathParts[0];
                    const displayName = `Prompt: ${directory}`;
                    const changeTime = new Date();
                    const relativeTime = formatRelativeTime(changeTime);
                    console.log(
                        `${
                            change.type === 'added'
                                ? chalk.green('add'.padEnd(7))
                                : change.type === 'modified'
                                  ? chalk.yellow('modify'.padEnd(7))
                                  : chalk.red('delete'.padEnd(7))
                        } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                    );
                }
            }

            if (convertedFragmentChanges.length > 0) {
                console.log(chalk.bold('\nFragment changes:'));
                console.log('─'.repeat(100));

                for (const change of convertedFragmentChanges) {
                    const pathParts = change.path.split(path.sep);
                    let category = '';
                    let name = '';

                    if (pathParts.length >= 2) {
                        category = pathParts[0];
                        name = pathParts[1].replace(/\.md$/, '');
                    } else if (pathParts.length === 1) {
                        name = pathParts[0].replace(/\.md$/, '');
                    }

                    const displayName = `Fragment: ${category}/${name}`;
                    const changeTime = new Date();
                    const relativeTime = formatRelativeTime(changeTime);
                    console.log(
                        `${
                            change.type === 'added'
                                ? chalk.green('add'.padEnd(7))
                                : change.type === 'modified'
                                  ? chalk.yellow('modify'.padEnd(7))
                                  : chalk.red('delete'.padEnd(7))
                        } ${displayName.padEnd(60)} ${chalk.gray(relativeTime)}`
                    );
                }
                console.log('─'.repeat(100));
            }

            if (await this.confirmAction('\nSync these changes to the git repository before pushing?')) {
                console.log(chalk.cyan('\nSyncing changes...'));

                for (const change of promptChanges) {
                    const srcPath = path.join(cliPromptsDir, change.path);
                    const destPath = path.join(LIBRARY_PROMPTS_DIR, change.path);

                    if (change.type === 'added' || change.type === 'modified') {
                        await fs.ensureDir(path.dirname(destPath));
                        await fs.copy(srcPath, destPath, { overwrite: true });
                    } else if (change.type === 'deleted') {
                        await fs.remove(destPath);
                    }
                }

                for (const change of fragmentChanges) {
                    const srcPath = path.join(cliFragmentsDir, change.path);
                    const destPath = path.join(LIBRARY_FRAGMENTS_DIR, change.path);

                    if (change.type === 'added' || change.type === 'modified') {
                        await fs.ensureDir(path.dirname(destPath));
                        await fs.copy(srcPath, destPath, { overwrite: true });
                    } else if (change.type === 'deleted') {
                        await fs.remove(destPath);
                    }
                }

                console.log(chalk.green('\n✓ Changes synced to git repository.'));
            } else {
                console.log(chalk.yellow('\nPush cancelled. Please sync your changes first.'));
                return;
            }
        }

        const changes = await getLibraryRepositoryChanges();

        if (changes.length === 0) {
            console.log(chalk.green('\n✓ No changes to push.'));
            console.log(chalk.gray('\nYour repository is in sync with the latest changes.'));
            return;
        }

        console.log(chalk.bold('\nChanges to push:'));
        console.log('─'.repeat(100));

        changes.forEach((change) => {
            const isPrompt = change.path.startsWith('prompts/');
            let dirName = '';
            const parts = change.path.split('/');

            if (parts.length >= 2) {
                dirName = parts[1];
            }

            let changeType = 'modify';

            if (change.status === '?' || change.status === 'A') {
                changeType = 'add';
            } else if (change.status === 'D') {
                changeType = 'delete';
            }

            const displayName = `${isPrompt ? 'Prompt: ' : 'Fragment: '}${dirName} (${change.path})`;
            console.log(
                `${
                    changeType === 'add'
                        ? chalk.green(changeType.padEnd(7))
                        : changeType === 'modify'
                          ? chalk.yellow(changeType.padEnd(7))
                          : chalk.red(changeType.padEnd(7))
                } ${displayName}`
            );
        });

        const gitConfig = getConfig();
        const defaultBranch = gitConfig.DEFAULT_BRANCH || 'main';
        const branch = branchName || defaultBranch;
        console.log(chalk.cyan(`\nBranch: ${branch}`));

        if (await this.confirmAction('Would you like to see the detailed changes?')) {
            const spinner = showSpinner('Generating diff...');

            try {
                const diff = await getFormattedDiff();
                spinner.stop(true);

                if (diff === 'No changes detected') {
                    console.log(chalk.yellow('\nNo changes detected in the diff.'));
                } else {
                    console.log('\nDetailed changes:');
                    console.log('─'.repeat(100));
                    console.log(diff);
                    console.log('─'.repeat(100));
                }
            } catch (error) {
                spinner.fail('Failed to generate diff');
                this.handleError(error, 'generating diff');
            }
        }

        console.log(chalk.cyan('\nCommit Message:'));
        const commitMessage = await this.getInput(`Enter commit message:`);

        if (!(await this.confirmAction('\nPush changes with this commit message?'))) {
            console.log(chalk.yellow('Push cancelled.'));
            return;
        }

        try {
            console.log(chalk.cyan('\nPushing changes...'));

            const spinner = showSpinner('Committing and pushing changes...');
            const success = await pushChangesToRemote(branch, commitMessage);

            if (success) {
                spinner.succeed('Push completed successfully');

                await clearPendingChanges();
                console.log(chalk.green('\n✓ Changes pushed successfully.'));
                console.log(chalk.bold(`Branch: ${branch}`));
                console.log(chalk.cyan(`Commit message: ${commitMessage}`));
                console.log('\nPlease create a pull request on the repository to merge your changes.');
            } else {
                spinner.fail('Push failed');
                console.log(chalk.red('\n❌ Failed to push changes. See logs for details.'));
            }
        } catch (error) {
            this.handleError(error, 'pushing changes');
        }
    }
}

export default new SyncCommand();
