/**
 * Git-related constants and utility functions.
 */
import * as path from 'path';

import * as fs from 'fs-extra';

import { BASE_DIR } from './paths';

/**
 * Standard path to the .git directory within the repository root.
 */
export const GIT_DIR = path.join(BASE_DIR, '.git');

/**
 * Checks if the application's base directory (`BASE_DIR`) contains a `.git` folder,
 * indicating it's likely a Git repository.
 *
 * @returns {boolean} `true` if a `.git` directory exists in `BASE_DIR`, `false` otherwise.
 */
export function isGitRepo(): boolean {
    // Check existence of the .git directory within the determined BASE_DIR
    return fs.existsSync(GIT_DIR);
}

/**
 * Common Git command arguments used for various operations via simple-git.
 * Organized by command type (branch, status, commit, etc.).
 */
export const GIT_COMMANDS = {
    // --- Branch Operations ---
    BRANCH: {
        /** Get the short symbolic name of the current branch (e.g., 'main'). */
        GET_CURRENT: ['rev-parse', '--abbrev-ref', 'HEAD'],
        /** Create a new local branch and check it out. Requires branch name argument. */
        CREATE: ['checkout', '-b'],
        /** List local branches. */
        LIST: ['branch', '--list'],
        /** Checkout an existing branch. Requires branch name argument. */
        CHECKOUT: ['checkout']
    },

    // --- Status Operations ---
    STATUS: {
        /** Get repository status in a machine-readable format. */
        GET_PORCELAIN: ['status', '--porcelain'],
        /** Get detailed repository status, including unstaged changes. */
        GET_DETAILED: ['status', '-v']
    },

    // --- Commit Operations ---
    COMMIT: {
        /** Stage all changes (tracked and untracked) in the working directory. */
        STAGE_ALL: ['add', '.'],
        /** Stage specific files or directories. Requires path argument(s). */
        STAGE_FILE: ['add'],
        /** Create a new commit with a message. Requires message argument. */
        COMMIT_WITH_MESSAGE: ['commit', '-m'],
        /** Amend the last commit without changing the commit message. */
        AMEND: ['commit', '--amend', '--no-edit']
    },

    // --- Remote Operations ---
    REMOTE: {
        /** Get the URL of a specific remote (e.g., 'origin'). Requires remote name argument. */
        GET_URL: ['remote', 'get-url'],
        /** Add a new remote repository. Requires remote name and URL arguments. */
        ADD: ['remote', 'add'],
        /** Set the URL for an existing remote. Requires remote name and URL arguments. */
        SET_URL: ['remote', 'set-url'],
        /** Set the upstream branch for the current local branch. Requires remote and branch arguments. */
        SET_UPSTREAM: ['push', '--set-upstream'],
        /** List all configured remote repositories with their URLs. */
        LIST: ['remote', '-v']
    },

    // --- Log Operations ---
    LOG: {
        /** Get the hash and subject of the most recent commit. */
        LAST_COMMIT: ['log', '-1', '--pretty=format:%h %s'],
        /** Get the hash and subject of commits since a specific ref. Requires ref argument. */
        COMMITS_SINCE: ['log', '--pretty=format:%h %s'],
        /** Get detailed information (including diff) for the last commit. */
        DETAILED: ['log', '-p', '-1']
    },

    // --- Diff Operations ---
    DIFF: {
        /** Show differences between the staging area (index) and the last commit. */
        STAGED: ['diff', '--staged'],
        /** Show differences between the working directory and the staging area. */
        UNSTAGED: ['diff'],
        /** Show a summary of changes (files changed, insertions, deletions). */
        SUMMARY: ['diff', '--stat'],
        /** Show differences between two commits or branches. Requires ref arguments. */
        COMMITS: ['diff']
    },

    // --- Fetch/Pull/Push Operations ---
    FETCH: {
        /** Fetch changes from a remote repository. Requires remote name argument. */
        REMOTE: ['fetch']
    },
    PULL: {
        /** Fetch changes from a remote and merge them into the current branch. Requires remote and branch arguments. */
        REMOTE_BRANCH: ['pull']
    },
    PUSH: {
        /** Push local commits to a remote repository. Requires remote and branch arguments. */
        REMOTE_BRANCH: ['push']
    },

    // --- Reset Operations ---
    RESET: {
        /** Discard changes in the working directory for specific files. Requires path argument(s). */
        CHECKOUT_FILES: ['checkout', '--'],
        /** Unstage changes for specific files. Requires path argument(s). */
        UNSTAGE_FILES: ['reset', 'HEAD', '--'],
        /** Reset current HEAD to the specified state, discarding changes. Requires commit/ref argument. */
        HARD: ['reset', '--hard']
    }
};
