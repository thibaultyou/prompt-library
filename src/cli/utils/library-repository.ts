import path from 'path';

import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';

import { hasPendingChangesInDb } from './database';
import { hasPendingChanges } from './sync-utils';
import { getConfig } from '../../shared/config';
import logger from '../../shared/utils/logger';
import {
    LIBRARY_HOME_DIR,
    LIBRARY_REPO_DIR,
    LIBRARY_PROMPTS_DIR,
    LIBRARY_FRAGMENTS_DIR
} from '../commands/base-command';

export { LIBRARY_FRAGMENTS_DIR, LIBRARY_HOME_DIR, LIBRARY_PROMPTS_DIR, LIBRARY_REPO_DIR };

export async function isLibraryRepositorySetup(): Promise<boolean> {
    try {
        const hasHomeDir = await fs.pathExists(LIBRARY_HOME_DIR);

        if (!hasHomeDir) return false;

        const config = getConfig();
        const useGit = config.USE_GIT;
        const hasPromptsDir = await fs.pathExists(LIBRARY_PROMPTS_DIR);
        const hasFragmentsDir = await fs.pathExists(LIBRARY_FRAGMENTS_DIR);

        if (!hasPromptsDir || !hasFragmentsDir) return false;

        if (!useGit) return true;

        const hasGitDir = await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git'));
        return hasGitDir;
    } catch (error) {
        logger.error('Error checking library repository setup:', error);
        return false;
    }
}

export function getLibraryPromptPath(promptDirectory: string): string {
    return path.join(LIBRARY_PROMPTS_DIR, promptDirectory);
}

export function getLibraryFragmentPath(fragmentCategory: string, fragmentName: string): string {
    return path.join(LIBRARY_FRAGMENTS_DIR, fragmentCategory, `${fragmentName}.md`);
}

export async function hasLibraryRepositoryChanges(): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }

        const config = getConfig();
        const useGit = config.USE_GIT;

        if (!useGit) {
            return await hasPendingChangesInDb();
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);

        if (untrackedOutput && untrackedOutput.trim().length > 0) {
            return true;
        }

        const status = await git.status();

        if (status.files.length > 0) {
            return true;
        }
        return await hasPendingChanges();
    } catch (error) {
        logger.error('Error checking for repository changes:', error);

        try {
            return await hasPendingChangesInDb();
        } catch (dbError) {
            logger.error('Also failed to check database for changes:', dbError);
            return false;
        }
    }
}

export async function getLibraryRepositoryChanges(): Promise<{ path: string; status: string }[]> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return [];
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        const status = await git.status();
        const trackedChanges = status.files.map((file) => ({
            path: file.path,
            status: file.working_dir || file.index
        }));
        const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);
        const untrackedChanges = untrackedOutput
            ? untrackedOutput
                  .trim()
                  .split('\n')
                  .filter((line) => line.trim() !== '')
                  .map((file) => ({ path: file, status: '?' }))
            : [];
        return [...trackedChanges, ...untrackedChanges];
    } catch (error) {
        logger.error('Error getting repository changes:', error);
        return [];
    }
}

export async function stageAllChanges(): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }

        const config = getConfig();

        if (!config.USE_GIT) {
            return false;
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        await git.add('.');
        return true;
    } catch (error) {
        logger.error('Error staging changes:', error);
        return false;
    }
}

export async function stagePromptChanges(promptDirectory: string): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }

        const config = getConfig();

        if (!config.USE_GIT) {
            logger.debug('Git is disabled, skipping staging prompt changes');
            return false;
        }

        if (!(await fs.pathExists(path.join(LIBRARY_REPO_DIR, '.git')))) {
            logger.debug('No git repository found, skipping staging prompt changes');
            return false;
        }

        try {
            const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
            const promptPath = path.join('prompts', promptDirectory);
            const promptFullPath = path.join(LIBRARY_REPO_DIR, promptPath);

            if (!(await fs.pathExists(promptFullPath))) {
                logger.debug(`Prompt directory ${promptPath} not found in repository`);
                return false;
            }

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

export async function commitChanges(message: string): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        await git.commit(message);
        return true;
    } catch (error) {
        logger.error('Error committing changes:', error);
        return false;
    }
}

export async function pushChanges(branch?: string): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return false;
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
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

export async function getFormattedDiff(): Promise<string> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            return 'Repository not set up';
        }

        const config = getConfig();

        if (!config.USE_GIT) {
            return 'Git integration is disabled';
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        await git.add('.');

        const diffResult = await git.diff(['--cached', '--color']);

        if (!diffResult || diffResult.trim() === '') {
            const allDiff = await git.diff();

            if (!allDiff || allDiff.trim() === '') {
                return 'No changes detected';
            }
            return allDiff;
        }
        return diffResult;
    } catch (error) {
        logger.error('Error getting formatted diff:', error);
        return `Error getting diff: ${error}`;
    }
}

export async function pushChangesToRemote(branch?: string, commitMessage?: string): Promise<boolean> {
    try {
        if (!(await isLibraryRepositorySetup())) {
            logger.error('Repository not set up');
            return false;
        }

        const config = getConfig();

        if (!config.USE_GIT) {
            logger.error('Git integration is disabled');
            return false;
        }

        const upstreamRepo = config.UPSTREAM_REPOSITORY;
        const defaultBranch = config.DEFAULT_BRANCH || 'main';
        const branchName = branch || defaultBranch;

        if (!upstreamRepo) {
            logger.error('No upstream repository configured');
            return false;
        }

        const git: SimpleGit = simpleGit(LIBRARY_REPO_DIR);
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);

        if (currentBranch !== branchName) {
            const branches = await git.branchLocal();

            if (branches.all.includes(branchName)) {
                await git.checkout(branchName);
                logger.info(`Switched to branch: ${branchName}`);
            } else {
                await git.checkoutLocalBranch(branchName);
                logger.info(`Created new branch: ${branchName}`);
            }
        }

        const status = await git.status();

        if (status.files.length > 0) {
            await git.add('.');
            logger.info('Staged all changes');

            const stagedStatus = await git.status();

            if (stagedStatus.staged.length > 0) {
                const message = commitMessage || `Update prompts and fragments via CLI [${new Date().toISOString()}]`;
                await git.commit(message);
                logger.info(`Committed changes with message: "${message}"`);
            } else {
                logger.info('No changes to commit');
            }
        } else {
            logger.info('No changes to commit');
        }

        const remotes = await git.getRemotes();
        let originExists = false;

        for (const remote of remotes) {
            if (remote.name === 'origin') {
                originExists = true;
                break;
            }
        }

        if (!originExists) {
            await git.remote(['add', 'origin', upstreamRepo]);
            logger.info(`Added origin remote: ${upstreamRepo}`);
        } else {
            await git.remote(['set-url', 'origin', upstreamRepo]);
            logger.info(`Updated origin remote to: ${upstreamRepo}`);
        }

        await git.push('origin', branchName, ['--set-upstream']);
        logger.info(`Pushed changes to ${upstreamRepo} branch: ${branchName}`);
        return true;
    } catch (error) {
        logger.error('Error pushing changes to remote:', error);
        return false;
    }
}
