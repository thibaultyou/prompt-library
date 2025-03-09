import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import { 
    syncPromptsWithDatabase, 
    cleanupOrphanedData, 
    storePendingChange, 
    getPendingChangesFromDb,
    clearPendingChangesFromDb,
    hasPendingChangesInDb,
    PendingChange
} from './database';
import { getConfig, setConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';

export interface FileChange {
    type: 'added' | 'modified' | 'deleted';
    path: string;
}

export async function getRepoUrl(
    optionUrl: string | undefined,
    promptFn: (message: string) => Promise<string>
): Promise<string> {
    const config = getConfig();
    let repoUrl = optionUrl || config.REMOTE_REPOSITORY;

    if (!repoUrl) {
        repoUrl = await promptFn('Enter the remote repository URL:');
        setConfig('REMOTE_REPOSITORY', repoUrl);
    }
    return repoUrl;
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
    logger.info('Cleaning up temporary directory...');
    await fs.remove(tempDir);
}

export async function cloneRepository(git: SimpleGit, repoUrl: string, tempDir: string): Promise<void> {
    logger.info('Fetching remote data...');
    await git.clone(repoUrl, tempDir);
}

export async function diffDirectories(localDir: string, remoteDir: string): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    async function traverseDirectory(
        currentLocalDir: string,
        currentRemoteDir: string,
        relativePath: string = ''
    ): Promise<void> {
        const localFiles: string[] = await fs.readdir(currentLocalDir).catch(() => []);
        const remoteFiles: string[] = await fs.readdir(currentRemoteDir).catch(() => []);

        for (const file of remoteFiles) {
            const localPath = path.join(currentLocalDir, file);
            const remotePath = path.join(currentRemoteDir, file);
            const currentRelativePath = path.join(relativePath, file);

            if (!localFiles.includes(file)) {
                changes.push({ type: 'added', path: currentRelativePath });
            } else {
                const remoteStats = await fs.stat(remotePath);

                if (remoteStats.isDirectory()) {
                    await traverseDirectory(localPath, remotePath, currentRelativePath);
                } else {
                    const [localContent, remoteContent] = await Promise.all([
                        fs.readFile(localPath, 'utf-8').catch(() => ''),
                        fs.readFile(remotePath, 'utf-8').catch(() => '')
                    ]);

                    if (localContent !== remoteContent) {
                        changes.push({ type: 'modified', path: currentRelativePath });
                    }
                }
            }
        }

        for (const file of localFiles) {
            if (!remoteFiles.includes(file)) {
                changes.push({ type: 'deleted', path: path.join(relativePath, file) });
            }
        }
    }

    await traverseDirectory(localDir, remoteDir);
    return changes;
}

export function logChanges(changes: FileChange[], title: string): void {
    if (changes.length > 0) {
        console.log(chalk.bold(`\n${title}:`));
        changes.forEach(({ type, path }) => {
            switch (type) {
                case 'added':
                    console.log(chalk.green(`  + ${path}`));
                    break;
                case 'modified':
                    console.log(chalk.yellow(`  * ${path}`));
                    break;
                case 'deleted':
                    console.log(chalk.red(`  - ${path}`));
                    break;
            }
        });
    }
}

export async function syncDirectories(localDir: string, remoteDir: string, changes: FileChange[]): Promise<void> {
    for (const { type, path: filePath } of changes) {
        const localPath = path.join(localDir, filePath);
        const remotePath = path.join(remoteDir, filePath);
        switch (type) {
            case 'added':
            case 'modified':
                await fs.ensureDir(path.dirname(localPath));
                await fs.copy(remotePath, localPath, { overwrite: true });
                break;
            case 'deleted':
                await fs.remove(localPath);
                break;
        }
    }
}

export async function performSync(
    tempDir: string,
    changes: FileChange[],
    fragmentChanges: FileChange[]
): Promise<void> {
    logger.info('Syncing prompts...');
    await syncDirectories(getConfig().PROMPTS_DIR, path.join(tempDir, 'prompts'), changes);

    logger.info('Syncing fragments...');
    await syncDirectories(getConfig().FRAGMENTS_DIR, path.join(tempDir, 'fragments'), fragmentChanges);

    logger.info('Updating database...');
    await syncPromptsWithDatabase();

    logger.info('Cleaning up orphaned data...');
    await cleanupOrphanedData();

    logger.info('Removing temporary files...');
    await fs.remove(tempDir);
}

/**
 * Create a new branch and push changes to remote
 */
export async function createBranchAndPushChanges(branchName: string): Promise<void> {
    try {
        const git: SimpleGit = simpleGit();
        
        // Check if repository exists
        if (!(await isGitRepository())) {
            throw new Error('Not a git repository');
        }
        
        // Create a new branch
        await git.checkoutLocalBranch(branchName);
        
        // Add all changes
        await git.add('.');
        
        // Commit changes
        await git.commit('Add new prompt via CLI');
        
        // Get remote and push
        const remotes = await git.getRemotes();
        if (remotes.length === 0) {
            throw new Error('No remote repository configured');
        }
        
        const remoteName = remotes[0].name;
        await git.push(remoteName, branchName, ['--set-upstream']);
        
        logger.info(`Changes pushed to remote branch: ${branchName}`);
    } catch (error) {
        logger.error('Failed to push changes to remote:', error);
        throw error;
    }
}

/**
 * Check if the current directory is a git repository
 */
async function isGitRepository(): Promise<boolean> {
    try {
        const git: SimpleGit = simpleGit();
        await git.revparse(['--is-inside-work-tree']);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Cache in-memory copy of changes for performance
 */
let pendingChangesCache: PendingChange[] | null = null;

/**
 * Add a change to the pending changes list and optionally add it to git
 */
export async function trackPromptChange(directory: string, type: 'add' | 'modify' | 'delete', title?: string): Promise<void> {
    const change: Omit<PendingChange, 'id'> = {
        directory,
        change_type: type,
        title: title || '',
        timestamp: Date.now()
    };
    
    // Store change in the database
    await storePendingChange(change);
    pendingChangesCache = null; // Invalidate cache
    
    // Optionally add the files to git staging
    try {
        if (await isGitRepository()) {
            // If we're in a git repo, try to stage the files
            const git: SimpleGit = simpleGit();
            
            // Only stage files for 'add' or 'modify' changes
            if (type === 'add' || type === 'modify') {
                // Get the full path to the prompt directory
                const { getConfig } = await import('../../shared/config');
                const config = getConfig();
                const promptDir = path.join(config.PROMPTS_DIR, directory);
                
                // Check if the directory exists
                const { fileExists } = await import('../../shared/utils/file-system');
                if (await fileExists(promptDir)) {
                    try {
                        // Add the directory to git staging
                        // Using git.add will automatically stage all files in the directory
                        await git.add([path.join('prompts', directory)]);
                        logger.info(`Added ${directory} to git staging`);
                    } catch (gitAddError) {
                        logger.debug(`Error adding ${directory} to git staging:`, gitAddError);
                    }
                }
            }
        }
    } catch (gitError) {
        // Silently fail - this is just a nice-to-have, not critical
        logger.debug('Failed to add files to git staging:', gitError);
    }
    
    logger.info(`Tracked change to prompt: ${title || directory} (${type})`);
}

/**
 * Get all pending changes that need to be synced
 * Uses git if available for accurate state, falls back to database
 */
export async function getPendingChanges(): Promise<PendingChange[]> {
    try {
        // Check if the library repository is set up
        const { getLibraryRepositoryChanges, isLibraryRepositorySetup } = await import('./library-repository');
        
        // First check if we should use the dedicated library repository
        if (await isLibraryRepositorySetup()) {
            // Get changes from the library repository
            const repoChanges = await getLibraryRepositoryChanges();
            
            // Convert to PendingChange format
            return repoChanges.map(change => {
                const isPrompt = change.path.startsWith('prompts/');
                
                // Extract directory name from path
                let directory = '';
                const parts = change.path.split('/');
                if (parts.length >= 2) {
                    directory = parts[1];
                }
                
                // Determine change type based on status
                let changeType: 'add' | 'modify' | 'delete';
                if (change.status === '?' || change.status === 'A') {
                    changeType = 'add';
                } else if (change.status === 'D') {
                    changeType = 'delete';
                } else {
                    changeType = 'modify';
                }
                
                return {
                    directory: directory,
                    change_type: changeType,
                    title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory}`,
                    timestamp: Date.now()
                };
            });
        }
        
        // Otherwise check if we're in a git repository (development mode)
        if (await isGitRepository()) {
            // Use git to get current status
            const git: SimpleGit = simpleGit();
            
            // Collect both tracked and untracked changes
            let allChanges: PendingChange[] = [];
            
            // First check untracked files
            try {
                const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard', 'prompts/', 'fragments/']);
                if (untrackedOutput && untrackedOutput.trim().length > 0) {
                    // Process untracked files
                    const untrackedFiles = untrackedOutput.trim().split('\n');
                    
                    // Create PendingChange objects for untracked files
                    const untrackedChanges = untrackedFiles.map(filePath => {
                        const isPrompt = filePath.startsWith('prompts/');
                        
                        // Extract directory name from path
                        let directory = '';
                        const parts = filePath.split('/');
                        if (parts.length >= 2) {
                            directory = parts[1];
                        }
                        
                        return {
                            directory: directory,
                            change_type: 'add' as 'add' | 'modify' | 'delete',
                            title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory} (new)`,
                            timestamp: Date.now()
                        };
                    });
                    
                    allChanges = [...allChanges, ...untrackedChanges];
                }
            } catch (err) {
                logger.debug('Error checking untracked files:', err);
            }
            
            // Now get tracked changes from status
            const status = await git.status();
            
            // Filter out only prompt/fragment changes
            const relevantChanges = status.files.filter(file => 
                file.path.startsWith('prompts/') || 
                file.path.startsWith('fragments/')
            );
            
            if (relevantChanges.length > 0) {
                // Convert git status changes to PendingChange format
                const trackedChanges: PendingChange[] = relevantChanges.map(file => {
                    const isPrompt = file.path.startsWith('prompts/');
                    
                    // Extract directory name from path
                    let directory = '';
                    const parts = file.path.split('/');
                    if (parts.length >= 2) {
                        directory = parts[1];
                    }
                    
                    // Determine change type
                    let changeType: 'add' | 'modify' | 'delete';
                    if (file.working_dir === 'A' || file.index === 'A') {
                        changeType = 'add';
                    } else if (file.working_dir === 'D' || file.index === 'D') {
                        changeType = 'delete';
                    } else {
                        changeType = 'modify';
                    }
                    
                    return {
                        directory: directory,
                        change_type: changeType,
                        title: `${isPrompt ? 'Prompt' : 'Fragment'}: ${directory}`,
                        timestamp: Date.now()
                    };
                });
                
                allChanges = [...allChanges, ...trackedChanges];
            }
            
            // Remove duplicates (by directory)
            const seen = new Set<string>();
            const uniqueChanges = allChanges.filter(change => {
                const key = change.directory;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            
            return uniqueChanges;
        }
        
        // Fall back to database if neither library nor development repo is available
        if (pendingChangesCache === null) {
            pendingChangesCache = await getPendingChangesFromDb();
        }
        return pendingChangesCache;
    } catch (error) {
        logger.warn('Error getting changes from git, falling back to database:', error);
        // Fall back to database if git fails
        if (pendingChangesCache === null) {
            pendingChangesCache = await getPendingChangesFromDb();
        }
        return pendingChangesCache;
    }
}

/**
 * Check if there are any pending changes by looking at git status in the library repository
 * This is more accurate than using the database since it reflects the actual file system state
 */
export async function hasPendingChanges(): Promise<boolean> {
    try {
        // Check for changes in the dedicated library repository
        const { hasLibraryRepositoryChanges, isLibraryRepositorySetup } = await import('./library-repository');
        
        // First check if the library repository is set up
        if (!(await isLibraryRepositorySetup())) {
            // If library not set up, check if we're in development mode
            if (await isGitRepository()) {
                // We're in a git repository (likely development mode)
                // Check for changes in the current directory
                const git: SimpleGit = simpleGit();
                const status = await git.status();
                
                // Check if there are any changes in the prompts or fragments directories
                const hasPromptChanges = status.files.some(file => 
                    file.path.startsWith('prompts/') || 
                    file.path.startsWith('fragments/')
                );
                
                return hasPromptChanges;
            }
            
            // Fall back to database as last resort
            return await hasPendingChangesInDb();
        }
        
        // Use the dedicated library repository check
        return await hasLibraryRepositoryChanges();
    } catch (error) {
        logger.warn('Error checking git status, falling back to database:', error);
        // Fall back to the database method if git fails
        return await hasPendingChangesInDb();
    }
}

/**
 * Clear pending changes after sync
 */
export async function clearPendingChanges(): Promise<void> {
    await clearPendingChangesFromDb();
    pendingChangesCache = null; // Invalidate cache
    logger.info('Cleared all pending changes');
}
