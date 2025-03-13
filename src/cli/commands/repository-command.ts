import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import { BaseCommand, LIBRARY_REPO_DIR } from './base-command';
import { getConfig, setConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { isLibraryRepositorySetup } from '../utils/library-repository';
import { printSectionHeader, showSpinner } from '../utils/ui-components';

class RepositoryCommand extends BaseCommand {
    constructor() {
        super('repository', 'Manage prompt library repository settings');
        this.option('--status', 'Show repository status')
            .option('--upstream <url>', 'Set upstream repository URL')
            .option('--downstream <url>', 'Add downstream repository URL')
            .option('--branch <name>', 'Set default branch name')
            .option('--list-remotes', 'List configured remote repositories')
            .option('--disable-git', 'Disable git integration')
            .option('--enable-git', 'Enable git integration')
            .action(this.execute.bind(this));
    }

    async execute(options: {
        status?: boolean;
        upstream?: string;
        downstream?: string;
        branch?: string;
        listRemotes?: boolean;
        disableGit?: boolean;
        enableGit?: boolean;
    }): Promise<void> {
        try {
            const repoSetup = await isLibraryRepositorySetup();

            if (!repoSetup) {
                console.log(chalk.yellow('⚠️ Prompt library repository is not set up.'));
                console.log(chalk.cyan('Run "prompt-library-cli setup" to set up the repository.'));
                return;
            }

            if (options.enableGit) {
                await this.enableGit();
                return;
            }

            if (options.disableGit) {
                await this.disableGit();
                return;
            }

            if (options.upstream) {
                await this.setUpstreamRepository(options.upstream);
                return;
            }

            if (options.downstream) {
                await this.addDownstreamRepository(options.downstream);
                return;
            }

            if (options.branch) {
                await this.setDefaultBranch(options.branch);
                return;
            }

            if (options.listRemotes) {
                await this.listRemotes();
                return;
            }

            if (options.status) {
                await this.showRepositoryStatus();
                return;
            }

            await this.showRepositoryMenu();
        } catch (error) {
            this.handleError(error, 'repository command');
        }
    }

    private async showRepositoryMenu(): Promise<void> {
        const config = getConfig();
        const useGit = config.USE_GIT;
        const defaultBranch = config.DEFAULT_BRANCH;
        const upstreamRepo = config.UPSTREAM_REPOSITORY;
        const downstreamRepos = config.DOWNSTREAM_REPOSITORIES;
        console.clear();
        printSectionHeader('Configure Repository', '📦');
        console.log(
            `${chalk.cyan('Git Integration:')}       ${useGit ? chalk.green('Enabled') : chalk.yellow('Disabled')}`
        );
        console.log(`${chalk.cyan('Default Branch:')}        ${defaultBranch || chalk.gray('(Not set)')}`);
        console.log(`${chalk.cyan('Upstream Repository:')}   ${upstreamRepo || chalk.gray('(Not set)')}`);
        console.log(`${chalk.cyan('Downstream Repositories:')}`);

        if (downstreamRepos.length === 0) {
            console.log(`  ${chalk.gray('(None configured)')}`);
        } else {
            downstreamRepos.forEach((repo, index) => {
                console.log(`  ${index + 1}. ${repo}`);
            });
        }

        console.log('─'.repeat(60));

        if (useGit) {
            try {
                const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
                const remotes = await git.getRemotes(true);

                if (remotes.length > 0) {
                    console.log(chalk.cyan('\nConfigured Git Remotes:'));
                    remotes.forEach((remote) => {
                        console.log(`  ${chalk.bold(remote.name)}: ${remote.refs.fetch}`);

                        if (remote.refs.push !== remote.refs.fetch) {
                            console.log(`    Push URL: ${remote.refs.push}`);
                        }
                    });
                    console.log('─'.repeat(60));
                }
            } catch (error) {
                logger.debug('Error getting git remotes:', error);
            }
        }

        while (true) {
            console.clear();
            printSectionHeader('Configure Repository', '📦');

            const action = await this.showMenu<string>('Use ↑↓ to select an action:', [
                { name: 'Show repository status', value: 'status' },
                { name: useGit ? 'Disable Git integration' : 'Enable Git integration', value: 'toggle-git' },
                { name: 'Set default branch name', value: 'branch' },
                { name: 'Set upstream repository', value: 'upstream' },
                { name: 'Add downstream repository', value: 'downstream' },
                { name: 'List configured remotes', value: 'list-remotes' },
                { name: 'Update remote settings', value: 'update-remotes' }
            ], 
            {
                clearConsole: false
            }
        );
            switch (action) {
                case 'status':
                    await this.showRepositoryStatus();
                    break;
                case 'toggle-git':
                    if (useGit) {
                        await this.disableGit();
                    } else {
                        await this.enableGit();
                    }
                    return;
                case 'branch':
                    await this.setDefaultBranchFromInput();
                    break;
                case 'upstream':
                    await this.setUpstreamRepositoryFromInput();
                    break;
                case 'downstream':
                    await this.addDownstreamRepositoryFromInput();
                    break;
                case 'list-remotes':
                    await this.listRemotes();
                    break;
                case 'update-remotes':
                    await this.updateRemotes();
                    break;
                case 'back':
                    return;
            }
        }
    }

    private async showRepositoryStatus(): Promise<void> {
        const config = getConfig();
        const useGit = config.USE_GIT;
        console.clear();
        printSectionHeader('Repository Status', '📦');

        if (!useGit) {
            console.log(chalk.yellow('Git integration is disabled.'));
            console.log(chalk.gray('Run "prompt-library-cli repository --enable-git" to enable Git integration.'));
            return;
        }

        try {
            const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
            const status = await git.status();
            const branchInfo = await git.branch();
            console.log(`${chalk.cyan('Current Branch:')}       ${chalk.green(branchInfo.current)}`);
            console.log(
                `${chalk.cyan('Local Changes:')}        ${
                    status.files.length > 0
                        ? chalk.yellow(`${status.files.length} file(s) modified`)
                        : chalk.green('Clean')
                }`
            );

            const remotes = await git.getRemotes(true);

            if (remotes.length === 0) {
                console.log(`${chalk.cyan('Remote Repository:')}    ${chalk.yellow('Not configured')}`);
            } else {
                console.log(`${chalk.cyan('Remote Repositories:')}`);
                remotes.forEach((remote) => {
                    console.log(`  ${chalk.bold(remote.name)}: ${remote.refs.fetch}`);
                });
            }

            const upstream = config.UPSTREAM_REPOSITORY;

            if (!upstream) {
                console.log(`${chalk.cyan('Upstream Repository:')}  ${chalk.yellow('Not configured')}`);
            } else {
                console.log(`${chalk.cyan('Upstream Repository:')}  ${chalk.green(upstream)}`);
            }

            if (status.files.length > 0) {
                console.log('\nChanged files:');
                status.files.forEach((file) => {
                    const statusSymbol =
                        file.working_dir === 'M'
                            ? '✏️ '
                            : file.working_dir === 'A'
                              ? '➕ '
                              : file.working_dir === 'D'
                                ? '❌ '
                                : '  ';
                    console.log(`  ${statusSymbol}${file.path}`);
                });
            }

            const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);

            if (untrackedOutput && untrackedOutput.trim().length > 0) {
                const untrackedFiles = untrackedOutput.trim().split('\n');
                console.log('\nUntracked files:');
                untrackedFiles.forEach((file) => {
                    console.log(`  ❓ ${file}`);
                });
            }
        } catch (error) {
            logger.error('Error getting repository status:', error);
            console.log(chalk.red('Failed to get repository status.'));
        }

        await this.pressKeyToContinue();
    }

    private async enableGit(): Promise<void> {
        const spinner = showSpinner('Enabling Git integration...');

        try {
            setConfig('USE_GIT', true);

            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (!hasGit) {
                const git = simpleGit();
                await fs.ensureDir(LIBRARY_REPO_DIR);
                await git.cwd(LIBRARY_REPO_DIR).init();

                const files = await fs.readdir(LIBRARY_REPO_DIR);

                if (files.length > 0) {
                    await git.add('.');
                    await git.commit('Initial commit');
                }
            }

            spinner.succeed('Git integration enabled');
        } catch (error) {
            spinner.fail('Failed to enable Git integration');
            this.handleError(error, 'enabling Git');
        }
    }

    private async disableGit(): Promise<void> {
        if (
            await this.confirmAction(
                chalk.yellow(
                    'Are you sure you want to disable Git integration? This will not delete any files but may affect syncing.'
                )
            )
        ) {
            setConfig('USE_GIT', false);
            console.log(chalk.green('Git integration disabled.'));
        }
    }

    private async setDefaultBranch(branchName: string): Promise<void> {
        setConfig('DEFAULT_BRANCH', branchName);
        console.log(chalk.green(`Default branch set to ${branchName}`));

        try {
            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (hasGit && getConfig().USE_GIT) {
                const git = simpleGit(LIBRARY_REPO_DIR);
                const branches = await git.branchLocal();

                if (branches.all.includes(branchName)) {
                    await git.checkout(branchName);
                    console.log(chalk.green(`Checked out existing branch: ${branchName}`));
                } else {
                    if (await this.confirmAction(`Branch "${branchName}" doesn't exist. Create it?`)) {
                        await git.checkoutLocalBranch(branchName);
                        console.log(chalk.green(`Created and checked out new branch: ${branchName}`));
                    }
                }
            }
        } catch (error) {
            logger.error('Error setting default branch:', error);
        }
    }

    private async setDefaultBranchFromInput(): Promise<void> {
        const branchName = await this.getInput(
            'Enter default branch name:',
            {
                validate: (input: string) => input.trim() !== '' || 'Branch name cannot be empty'
            }
        );
        await this.setDefaultBranch(branchName);
    }

    private async setUpstreamRepository(repoUrl: string): Promise<void> {
        setConfig('UPSTREAM_REPOSITORY', repoUrl);
        console.log(chalk.green(`Upstream repository set to ${repoUrl}`));

        try {
            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (hasGit && getConfig().USE_GIT) {
                const git = simpleGit(LIBRARY_REPO_DIR);
                const remotes = await git.getRemotes();
                const hasOrigin = remotes.some((remote) => remote.name === 'origin');

                if (hasOrigin) {
                    if (
                        await this.confirmAction('Remote "origin" already exists. Update it to the new upstream URL?')
                    ) {
                        await git.remote(['set-url', 'origin', repoUrl]);
                        console.log(chalk.green('Updated origin remote URL'));
                    }
                } else {
                    await git.remote(['add', 'origin', repoUrl]);
                    console.log(chalk.green('Added origin remote'));
                }
            }
        } catch (error) {
            logger.error('Error updating git remote:', error);
        }
    }

    private async setUpstreamRepositoryFromInput(): Promise<void> {
        const currentUpstream = getConfig().UPSTREAM_REPOSITORY;
        const repoUrl = await this.getInput(
            `Enter upstream repository URL ${currentUpstream ? `(current: ${currentUpstream})` : ''}:`,
            {
                validate: (input: string) => input.trim() !== '' || 'Repository URL cannot be empty',
                default: currentUpstream || ''
            }
        );
        await this.setUpstreamRepository(repoUrl);
    }

    private async addDownstreamRepository(repoUrl: string): Promise<void> {
        const config = getConfig();
        const downstreamRepos = [...config.DOWNSTREAM_REPOSITORIES];

        if (!downstreamRepos.includes(repoUrl)) {
            downstreamRepos.push(repoUrl);
            setConfig('DOWNSTREAM_REPOSITORIES', downstreamRepos);
            console.log(chalk.green(`Added downstream repository: ${repoUrl}`));
        } else {
            console.log(chalk.yellow(`Repository ${repoUrl} is already in downstream list.`));
        }

        try {
            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (hasGit && getConfig().USE_GIT) {
                const git = simpleGit(LIBRARY_REPO_DIR);
                const remotes = await git.getRemotes();
                let remoteName = 'downstream';
                let counter = 1;
                while (remotes.some((remote) => remote.name === remoteName)) {
                    remoteName = `downstream${counter++}`;
                }

                await git.remote(['add', remoteName, repoUrl]);
                console.log(chalk.green(`Added git remote "${remoteName}" for ${repoUrl}`));
            }
        } catch (error) {
            logger.error('Error adding git remote:', error);
        }
    }

    private async addDownstreamRepositoryFromInput(): Promise<void> {
        const repoUrl = await this.getInput(
            'Enter downstream repository URL:',
            {
                validate: (input: string) => input.trim() !== '' || 'Repository URL cannot be empty'
            }
        );
        await this.addDownstreamRepository(repoUrl);
    }

    private async listRemotes(): Promise<void> {
        try {
            const config = getConfig();
            const useGit = config.USE_GIT;
            console.log(chalk.bold(chalk.cyan('\n📦 Repository Remotes\n')));

            if (!useGit) {
                console.log(chalk.yellow('Git integration is disabled.'));
                console.log(chalk.gray('Run "prompt-library-cli repository --enable-git" to enable Git integration.'));
                return;
            }

            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (!hasGit) {
                console.log(chalk.yellow('No Git repository found.'));
                console.log(chalk.gray('Run "prompt-library-cli setup" to set up the repository.'));
                return;
            }

            const git = simpleGit(LIBRARY_REPO_DIR);
            const remotes = await git.getRemotes(true);

            if (remotes.length === 0) {
                console.log(chalk.yellow('No remotes configured.'));
                console.log(chalk.gray('Use "prompt-library-cli repository --upstream <url>" to add a remote.'));
                return;
            }

            console.log(chalk.cyan('Configured Git Remotes:'));
            remotes.forEach((remote) => {
                console.log(`  ${chalk.bold(remote.name)}: ${remote.refs.fetch}`);

                if (remote.refs.push !== remote.refs.fetch) {
                    console.log(`    Push URL: ${remote.refs.push}`);
                }
            });

            console.log('\nConfiguration:');
            console.log(
                `  ${chalk.cyan('Upstream Repository:')}   ${config.UPSTREAM_REPOSITORY || chalk.gray('(Not set)')}`
            );
            console.log(`  ${chalk.cyan('Downstream Repositories:')}`);

            if (config.DOWNSTREAM_REPOSITORIES.length === 0) {
                console.log(`    ${chalk.gray('(None configured)')}`);
            } else {
                config.DOWNSTREAM_REPOSITORIES.forEach((repo, index) => {
                    console.log(`    ${index + 1}. ${repo}`);
                });
            }
        } catch (error) {
            logger.error('Error listing remotes:', error);
            console.log(chalk.red('Failed to list remotes.'));
        }

        await this.pressKeyToContinue();
    }

    private async updateRemotes(): Promise<void> {
        try {
            const config = getConfig();
            const useGit = config.USE_GIT;

            if (!useGit) {
                console.log(chalk.yellow('Git integration is disabled.'));
                return;
            }

            const hasGit = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));

            if (!hasGit) {
                console.log(chalk.yellow('No Git repository found.'));
                return;
            }

            const git = simpleGit(LIBRARY_REPO_DIR);

            if (config.UPSTREAM_REPOSITORY) {
                const remotes = await git.getRemotes();
                const hasOrigin = remotes.some((remote) => remote.name === 'origin');

                if (hasOrigin) {
                    await git.remote(['set-url', 'origin', config.UPSTREAM_REPOSITORY]);
                    console.log(chalk.green('Updated origin remote URL'));
                } else {
                    await git.remote(['add', 'origin', config.UPSTREAM_REPOSITORY]);
                    console.log(chalk.green('Added origin remote'));
                }
            }

            if (config.DOWNSTREAM_REPOSITORIES.length > 0) {
                const remotes = await git.getRemotes();

                for (let i = 0; i < config.DOWNSTREAM_REPOSITORIES.length; i++) {
                    const repoUrl = config.DOWNSTREAM_REPOSITORIES[i];
                    const remoteName = `downstream${i + 1}`;
                    const hasRemote = remotes.some((remote) => remote.name === remoteName);

                    if (hasRemote) {
                        await git.remote(['set-url', remoteName, repoUrl]);
                        console.log(chalk.green(`Updated ${remoteName} remote URL`));
                    } else {
                        await git.remote(['add', remoteName, repoUrl]);
                        console.log(chalk.green(`Added ${remoteName} remote`));
                    }
                }
            }

            console.log(chalk.green('Remotes updated successfully.'));
        } catch (error) {
            logger.error('Error updating remotes:', error);
            console.log(chalk.red('Failed to update remotes.'));
        }

        await this.pressKeyToContinue();
    }
}

export default new RepositoryCommand();
