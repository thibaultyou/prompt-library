import path from 'path';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';
import chalk from 'chalk';

import { BaseCommand, LIBRARY_HOME_DIR, LIBRARY_REPO_DIR, LIBRARY_PROMPTS_DIR, LIBRARY_FRAGMENTS_DIR } from './base-command';
import { showSpinner } from '../utils/ui-components';
import logger from '../../shared/utils/logger';

class SetupCommand extends BaseCommand {
    constructor() {
        super('setup', 'Setup the prompt library repository');
        this.option('-f, --force', 'Force setup even if repository already exists')
            .option('-r, --repository <url>', 'URL of the repository to clone', 'https://github.com/thibaultyou/prompt-library.git')
            .option('--local', 'Use local development repository instead of remote')
            .action(this.execute.bind(this));
    }

    async execute(options: { force?: boolean; repository?: string; local?: boolean }): Promise<void> {
        try {
            // Check if already set up
            const isSetup = await this.isLibraryRepositorySetup();
            
            if (isSetup && !options.force) {
                console.log(chalk.green('✓ Prompt library is already set up!'));
                console.log(chalk.gray(`Repository located at: ${LIBRARY_REPO_DIR}`));
                
                // Check if git remotes are configured properly
                try {
                    const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
                    const remotes = await git.getRemotes(true);
                    const hasOrigin = remotes.some(remote => remote.name === 'origin');
                    
                    if (!hasOrigin) {
                        console.log(chalk.yellow('⚠️ No remote repository configured.'));
                        if (await this.confirmAction('Would you like to set up a remote repository?')) {
                            await this.setupRemote(git, options.repository || 'https://github.com/thibaultyou/prompt-library.git');
                        }
                    } else {
                        console.log(chalk.green('✓ Remote repository configured.'));
                    }
                } catch (error) {
                    logger.error('Error checking git remotes:', error);
                }
                
                return;
            }

            console.log(chalk.bold('🔧 Setting up Prompt Library...'));
            
            // Create library home directory
            await fs.ensureDir(LIBRARY_HOME_DIR);
            
            // Initialize repository based on the option
            if (options.local) {
                await this.setupFromLocalRepo();
            } else {
                await this.setupFromRemote(options.repository || 'https://github.com/thibaultyou/prompt-library.git');
            }
            
            console.log(chalk.green('✓ Prompt library setup completed!'));
            console.log(chalk.gray(`Repository located at: ${LIBRARY_REPO_DIR}`));
            console.log();
            console.log(chalk.cyan('You can now use the CLI to:'));
            console.log(chalk.cyan('- Browse and run prompts: ') + 'prompt-library-cli');
            console.log(chalk.cyan('- Update repository: ') + 'prompt-library-cli sync');
            console.log();
        } catch (error) {
            this.handleError(error, 'setting up prompt library');
        }
    }
    
    /**
     * Setup the repository by cloning from a remote URL
     */
    private async setupFromRemote(repoUrl: string): Promise<void> {
        const spinner = showSpinner('Cloning repository...');
        
        try {
            // Remove existing repository if it exists
            if (await fs.pathExists(LIBRARY_REPO_DIR)) {
                await fs.remove(LIBRARY_REPO_DIR);
            }
            
            // Create parent directory
            await fs.ensureDir(LIBRARY_HOME_DIR);
            
            // Clone the repository
            const git: SimpleGit = simpleGit();
            await git.clone(repoUrl, LIBRARY_REPO_DIR);
            
            spinner.succeed('Repository cloned successfully');
            
            // Ensure the prompts and fragments directories exist
            await fs.ensureDir(LIBRARY_PROMPTS_DIR);
            await fs.ensureDir(LIBRARY_FRAGMENTS_DIR);
            
        } catch (error) {
            spinner.fail('Failed to clone repository');
            throw error;
        }
    }
    
    /**
     * Setup the repository by copying from the local development repository
     */
    private async setupFromLocalRepo(): Promise<void> {
        const spinner = showSpinner('Setting up from local repository...');
        
        try {
            // Remove existing repository if it exists
            if (await fs.pathExists(LIBRARY_REPO_DIR)) {
                await fs.remove(LIBRARY_REPO_DIR);
            }
            
            // Get the current working directory (development repository)
            const cwd = process.cwd();
            
            // Initialize new git repository
            await fs.ensureDir(LIBRARY_REPO_DIR);
            const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
            await git.init();
            
            // Copy prompts and fragments from the development repository
            const localPromptsDir = path.join(cwd, 'prompts');
            const localFragmentsDir = path.join(cwd, 'fragments');
            
            await fs.ensureDir(LIBRARY_PROMPTS_DIR);
            await fs.ensureDir(LIBRARY_FRAGMENTS_DIR);
            
            // Copy prompts if they exist in the source repo
            if (await fs.pathExists(localPromptsDir)) {
                logger.info(`Copying prompts from ${localPromptsDir} to ${LIBRARY_PROMPTS_DIR}`);
                await fs.copy(localPromptsDir, LIBRARY_PROMPTS_DIR);
                
                // Make sure new files are staged in git
                try {
                    // Stage all files in the prompts directory 
                    await git.add('prompts');
                    logger.info('Staged prompt files in git');
                } catch (gitError) {
                    logger.error('Error staging prompt files:', gitError);
                }
            }
            
            // Copy fragments if they exist in the source repo
            if (await fs.pathExists(localFragmentsDir)) {
                logger.info(`Copying fragments from ${localFragmentsDir} to ${LIBRARY_FRAGMENTS_DIR}`);
                await fs.copy(localFragmentsDir, LIBRARY_FRAGMENTS_DIR);
                
                // Make sure new files are staged in git
                try {
                    // Stage all files in the fragments directory
                    await git.add('fragments');
                    logger.info('Staged fragment files in git');
                } catch (gitError) {
                    logger.error('Error staging fragment files:', gitError);
                }
            }
            
            // Initial commit
            await git.add('.');
            await git.commit('Initial commit');
            
            spinner.succeed('Local repository setup completed');
            
        } catch (error) {
            spinner.fail('Failed to setup from local repository');
            throw error;
        }
    }
    
    /**
     * Set up remote for an existing repository
     */
    private async setupRemote(git: SimpleGit, repoUrl: string): Promise<void> {
        const spinner = showSpinner('Configuring remote repository...');
        
        try {
            await git.addRemote('origin', repoUrl);
            spinner.succeed('Remote repository configured');
        } catch (error) {
            spinner.fail('Failed to configure remote repository');
            throw error;
        }
    }
}

export default new SetupCommand();