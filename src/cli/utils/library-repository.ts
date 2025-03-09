import path from 'path';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import { LIBRARY_HOME_DIR, LIBRARY_REPO_DIR, LIBRARY_PROMPTS_DIR, LIBRARY_FRAGMENTS_DIR } from '../commands/base-command';
import logger from '../../shared/utils/logger';
import { getConfig, setConfig } from '../../shared/config';

/**
 * Check if the prompt library repository is properly set up
 */
export async function isLibraryRepositorySetup(): Promise<boolean> {
    try {
        // Check if the library home directory exists
        const hasHomeDir = await fs.pathExists(LIBRARY_HOME_DIR);
        if (!hasHomeDir) return false;
        
        // Check if Git is enabled in the configuration
        const config = getConfig();
        const useGit = config.USE_GIT;
        
        // Check for basic structure (prompts and fragments directories)
        const hasPromptsDir = await fs.pathExists(LIBRARY_PROMPTS_DIR);
        const hasFragmentsDir = await fs.pathExists(LIBRARY_FRAGMENTS_DIR);
        
        if (!hasPromptsDir || !hasFragmentsDir) return false;
        
        // If Git is disabled, just require the directories to exist
        if (!useGit) return true;
        
        // If Git is enabled, check if the repository is properly set up
        const hasGitDir = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));
        return hasGitDir;
    } catch (error) {
        logger.error('Error checking library repository setup:', error);
        return false;
    }
}

/**
 * Get the path to the prompt directory within the library repository
 */
export function getLibraryPromptPath(promptDirectory: string): string {
    return path.join(LIBRARY_PROMPTS_DIR, promptDirectory);
}

/**
 * Get the path to the fragment directory within the library repository
 */
export function getLibraryFragmentPath(fragmentCategory: string, fragmentName: string): string {
    return path.join(LIBRARY_FRAGMENTS_DIR, fragmentCategory, `${fragmentName}.md`);
}

/**
 * Check for pending changes in the library repository
 * Uses git if available, more accurate than database tracking
 */
export async function hasLibraryRepositoryChanges(): Promise<boolean> {
    try {
        // First check if the repository is set up
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }
        
        // Check if Git is enabled in the configuration
        const config = getConfig();
        const useGit = config.USE_GIT;
        
        // If Git is disabled, rely on database tracking
        if (!useGit) {
            const { hasPendingChangesInDb } = await import('./database');
            return await hasPendingChangesInDb();
        }
        
        // Use git to check if there are any changes
        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        
        // Check for untracked files first
        const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);
        if (untrackedOutput && untrackedOutput.trim().length > 0) {
            return true;
        }
        
        // Check status for tracked files
        const status = await git.status();
        return status.files.length > 0;
    } catch (error) {
        logger.error('Error checking for repository changes:', error);
        
        // Fall back to database tracking
        try {
            const { hasPendingChangesInDb } = await import('./database');
            return await hasPendingChangesInDb();
        } catch (dbError) {
            logger.error('Also failed to check database for changes:', dbError);
            return false;
        }
    }
}

/**
 * Get all changed files in the library repository 
 */
export async function getLibraryRepositoryChanges(): Promise<{path: string; status: string}[]> {
    try {
        // First check if the repository is set up
        if (!(await isLibraryRepositorySetup())) {
            return [];
        }
        
        // Use git to check for changes
        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        const status = await git.status();
        
        // Get tracked changes
        const trackedChanges = status.files.map(file => ({
            path: file.path,
            status: file.working_dir || file.index
        }));
        
        // Get untracked files
        const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);
        const untrackedChanges = untrackedOutput ? 
            untrackedOutput.trim().split('\n')
                .filter(line => line.trim() !== '')
                .map(file => ({ path: file, status: '?' })) : 
            [];
        
        return [...trackedChanges, ...untrackedChanges];
    } catch (error) {
        logger.error('Error getting repository changes:', error);
        return [];
    }
}

/**
 * Stage all changes in the library repository
 */
export async function stageAllChanges(): Promise<boolean> {
    try {
        // First check if the repository is set up
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }
        
        // Check if Git is enabled
        const config = getConfig();
        if (!config.USE_GIT) {
            return false;
        }
        
        // Use git to stage all changes
        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        await git.add('.');
        return true;
    } catch (error) {
        logger.error('Error staging changes:', error);
        return false;
    }
}

/**
 * Stage changes for a specific prompt directory
 * Used after creating or editing a prompt
 */
export async function stagePromptChanges(promptDirectory: string): Promise<boolean> {
    try {
        // First check if the repository is set up and git is enabled
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }
        
        // Check if Git is enabled
        const config = getConfig();
        if (!config.USE_GIT) {
            logger.debug('Git is disabled, skipping staging prompt changes');
            return false;
        }
        
        // Make sure the .git directory exists in the library repo
        if (!(await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git')))) {
            logger.debug('No git repository found, skipping staging prompt changes');
            return false;
        }
        
        try {
            // Stage changes for the prompt directory
            const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
            
            // Build the path to the prompt directory within the repo
            const promptPath = path.join('prompts', promptDirectory);
            
            // Check if the directory exists in the repo
            const promptFullPath = path.join(LIBRARY_REPO_DIR, promptPath);
            if (!(await fs.pathExists(promptFullPath))) {
                logger.debug(`Prompt directory ${promptPath} not found in repository`);
                return false;
            }
            
            // Stage all files in the prompt directory
            logger.info(`Staging changes for prompt directory: ${promptPath}`);
            await git.add(promptPath);
            
            return true;
        } catch (gitError) {
            logger.error('Error staging prompt changes:', gitError);
            return false;
        }
    } catch (error) {
        logger.error('Error in stagePromptChanges:', error);
        return false;
    }
}

/**
 * Commit all staged changes in the library repository
 */
export async function commitChanges(message: string): Promise<boolean> {
    try {
        // First check if the repository is set up
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }
        
        // Use git to commit changes
        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        await git.commit(message);
        return true;
    } catch (error) {
        logger.error('Error committing changes:', error);
        return false;
    }
}

/**
 * Push changes to the remote repository
 */
export async function pushChanges(branch?: string): Promise<boolean> {
    try {
        // First check if the repository is set up
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }
        
        // Use git to push changes
        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        
        // Check if there's a remote configured
        const remotes = await git.getRemotes();
        if (remotes.length === 0) {
            logger.warn('No remote repository configured. Cannot push changes.');
            return false;
        }
        
        const remoteName = remotes[0].name;
        const branchName = branch || 'main';
        
        await git.push(remoteName, branchName);
        return true;
    } catch (error) {
        logger.error('Error pushing changes:', error);
        return false;
    }
}