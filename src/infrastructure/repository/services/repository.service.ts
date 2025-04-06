import path from 'path';

import { Injectable, Scope, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import fs from 'fs-extra';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

import { BASE_DIR, PROMPTS_DIR, FRAGMENTS_DIR, REPOSITORY_PATHS } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { ConfigService } from '../../config/services/config.service';
import { DatabaseService } from '../../database/services/database.service';
import { ErrorService } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class RepositoryService implements OnModuleInit {
    private git: SimpleGit | null = null;

    constructor(
        private readonly dbService: DatabaseService,
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {
        this.loggerService.debug('RepositoryService Constructor called.');
    }

    async onModuleInit(): Promise<void> {
        this.loggerService.debug('RepositoryService onModuleInit: Initializing Git instance...');

        try {
            if (await fs.pathExists(BASE_DIR)) {
                const isRepo = await fs.pathExists(REPOSITORY_PATHS.GIT);

                if (isRepo) {
                    this.git = simpleGit(BASE_DIR);
                    this.loggerService.debug('SimpleGit instance initialized.');
                } else {
                    this.loggerService.warn(
                        `Directory ${BASE_DIR} exists but is not a Git repository. Git operations will fail.`
                    );
                    this.git = null;
                }
            } else {
                this.loggerService.warn(`Base directory ${BASE_DIR} does not exist. Cannot initialize Git instance.`);
                this.git = null;
            }
        } catch (error) {
            this.loggerService.error(`Failed to initialize SimpleGit: ${error}`);
            this.git = null;
        }
    }

    private getGitInstance(): SimpleGit {
        if (!this.git) {
            this.loggerService.error('Attempted to use Git instance, but it was not initialized successfully.');
            throw new Error('Git repository is not available or not initialized.');
        }
        return this.git;
    }

    private async isRepositoryInitialized(): Promise<boolean> {
        return !!this.git;
    }

    public async isLibraryRepositorySetup(): Promise<ApiResult<boolean>> {
        try {
            const hasBaseDir = await fs.pathExists(BASE_DIR);

            if (!hasBaseDir) {
                this.loggerService.debug(`Base directory ${BASE_DIR} does not exist. Repo not set up.`);
                return Result.success(false);
            }

            const hasPromptsDir = await fs.pathExists(PROMPTS_DIR);
            const hasFragmentsDir = await fs.pathExists(FRAGMENTS_DIR);

            if (!hasPromptsDir || !hasFragmentsDir) {
                this.loggerService.debug(`Prompts or Fragments directory missing. Repo not fully set up.`);
                return Result.success(false);
            }

            const useGitResult = this.configService.getConfigValue('USE_GIT');
            const useGit = useGitResult.success ? useGitResult.data : true;

            if (!useGit) {
                this.loggerService.debug(
                    'Git integration disabled. Setup considered complete based on directory existence.'
                );
                return Result.success(true);
            }

            if (!(await this.isRepositoryInitialized())) {
                this.loggerService.debug(`Git instance not initialized. Repo not set up.`);
                return Result.success(false);
            }

            this.loggerService.debug('Repository setup verified (directories exist, Git initialized).');
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error checking library repository setup:', error);
            return Result.failure(`Error checking setup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public getLibraryPromptPath(promptDirectory: string): string {
        return path.join(PROMPTS_DIR, promptDirectory);
    }

    public getLibraryFragmentPath(fragmentCategory: string, fragmentName: string): string {
        return path.join(FRAGMENTS_DIR, fragmentCategory, `${fragmentName}.md`);
    }

    public async countPendingChanges(): Promise<ApiResult<number>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.success(0);

            const git = this.getGitInstance();
            const status = await git.status();
            const filtered = status.files.filter(
                (file) => file.path.startsWith('prompts/') || file.path.startsWith('fragments/')
            );
            return Result.success(filtered.length);
        } catch (error) {
            this.errorService.handleError(error, 'counting pending repository changes');
            return Result.failure(
                `Failed to count changes: ${error instanceof Error ? error.message : String(error)}`,
                { data: 0 }
            );
        }
    }

    public async getRepositoryInfo(): Promise<ApiResult<{ branch?: string; url?: string }>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.success({ branch: undefined, url: undefined });

            const git = this.getGitInstance();
            const branch = await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '');
            const remotes = await git.getRemotes(true).catch(() => []);
            const url = remotes.find((r) => r.name === 'origin')?.refs?.fetch ?? '';
            return Result.success({ branch, url });
        } catch (error) {
            this.loggerService.error('Error getting repository info:', error);
            return Result.failure(
                `Failed to get repository info: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getCurrentBranch(): Promise<ApiResult<string>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Repository not initialized');

            const git = this.getGitInstance();
            const branch = await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '');
            return Result.success(branch);
        } catch (error) {
            this.loggerService.error('Error getting current branch:', error);
            return Result.failure(
                `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getRepoBranches(): Promise<ApiResult<string[]>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Repository not initialized');

            const git = this.getGitInstance();
            const branchSummary = await git.branch();
            const localBranches = Object.values(branchSummary.branches)
                .map((b) => b.name)
                .filter((name) => !name.startsWith('remotes/'));
            return Result.success(localBranches);
        } catch (error) {
            this.loggerService.error('Error getting repository branches:', error);
            return Result.failure(`Failed to get branches: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async createAndCheckoutBranch(branchName: string): Promise<ApiResult<void>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Repository not initialized');

            const sanitizedBranchName = branchName.replace(/[^a-zA-Z0-9_\-/]/g, '-');
            const git = this.getGitInstance();
            await git.checkoutLocalBranch(sanitizedBranchName);
            this.loggerService.info(`Created and checked out branch: ${sanitizedBranchName}`);
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error creating and checking out branch:', error);
            return Result.failure(`Failed to create branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async checkoutBranch(branchName: string): Promise<ApiResult<void>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Repository not initialized');

            const git = this.getGitInstance();
            await git.checkout(branchName);
            this.loggerService.info(`Checked out branch: ${branchName}`);
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error('Error checking out branch:', error);
            return Result.failure(
                `Failed to checkout branch: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async setupFromRemoteUrl(remoteUrl: string): Promise<ApiResult<string>> {
        try {
            await fs.ensureDir(BASE_DIR);
            const isAlreadyGitRepo = await fs.pathExists(REPOSITORY_PATHS.GIT);

            if (isAlreadyGitRepo) {
                this.loggerService.warn(`Git repository already exists in ${BASE_DIR}. Updating remote 'origin'.`);

                if (!this.git) await this.onModuleInit();

                const git = this.getGitInstance();

                try {
                    const remotes = await git.getRemotes(true);

                    if (remotes.some((r) => r.name === 'origin')) {
                        await git.remote(['set-url', 'origin', remoteUrl]);
                        this.loggerService.info(`Updated 'origin' remote to ${remoteUrl}`);
                    } else {
                        await git.addRemote('origin', remoteUrl);
                        this.loggerService.info(`Added 'origin' remote pointing to ${remoteUrl}`);
                    }

                    await git.fetch('origin');
                } catch (gitError) {
                    this.errorService.handleError(gitError, 'updating git remote');
                    return Result.failure(
                        `Failed to update git remote: ${gitError instanceof Error ? gitError.message : String(gitError)}`,
                        { data: BASE_DIR }
                    );
                }
            } else {
                this.loggerService.info(`Cloning repository from ${remoteUrl} into ${BASE_DIR}...`);
                await simpleGit().clone(remoteUrl, BASE_DIR);
                this.loggerService.info('Repository cloned successfully');
                await this.onModuleInit();
            }

            await fs.ensureDir(PROMPTS_DIR);
            await fs.ensureDir(FRAGMENTS_DIR);
            await this.ensureGitignore();
            this.dbService.flushCache();
            return Result.success(BASE_DIR);
        } catch (error) {
            this.errorService.handleError(error, 'setting up from remote URL');
            return Result.failure(
                `Failed to setup repository: ${error instanceof Error ? error.message : String(error)}`,
                { data: BASE_DIR }
            );
        }
    }

    public async setupFromLocalDirectory(localDir: string): Promise<ApiResult<{ path: string; url?: string }>> {
        try {
            const normalizedPath = path.resolve(localDir);

            if (!(await fs.pathExists(normalizedPath))) {
                return Result.failure(`Directory does not exist: ${normalizedPath}`, { data: { path: BASE_DIR } });
            }

            const sourceIsGitRepo = await fs.pathExists(path.join(normalizedPath, '.git'));
            const remoteUrl: string | undefined = await this.setupGitRepository(sourceIsGitRepo, normalizedPath);
            await fs.ensureDir(BASE_DIR);
            await this.copyContentDirectories(normalizedPath);
            await this.ensureGitignore();

            try {
                const git = this.getGitInstance();
                await git.add('.');
                this.loggerService.info('Staged all changes to git repository');
            } catch (gitError) {
                this.errorService.handleError(gitError, 'staging repository changes');
            }

            this.dbService.flushCache();
            return Result.success({ path: BASE_DIR, url: remoteUrl });
        } catch (error) {
            this.errorService.handleError(error, 'setting up from local directory');
            return Result.failure(
                `Failed to setup repository: ${error instanceof Error ? error.message : String(error)}`,
                { data: { path: BASE_DIR } }
            );
        }
    }

    private async copyContentDirectories(sourcePath: string): Promise<void> {
        const sourcePromptsDir = path.join(sourcePath, 'prompts');
        const sourceFragmentsDir = path.join(sourcePath, 'fragments');
        await fs.ensureDir(PROMPTS_DIR);
        await fs.ensureDir(FRAGMENTS_DIR);

        if (await fs.pathExists(sourcePromptsDir)) {
            this.loggerService.info(`Copying prompts from ${sourcePromptsDir} to ${PROMPTS_DIR}`);
            await fs.copy(sourcePromptsDir, PROMPTS_DIR, { overwrite: true });
        } else {
            this.loggerService.warn(`No prompts directory found in source: ${sourcePromptsDir}`);
        }

        if (await fs.pathExists(sourceFragmentsDir)) {
            this.loggerService.info(`Copying fragments from ${sourceFragmentsDir} to ${FRAGMENTS_DIR}`);
            await fs.copy(sourceFragmentsDir, FRAGMENTS_DIR, { overwrite: true });
        } else {
            this.loggerService.warn(`No fragments directory found in source: ${sourceFragmentsDir}`);
        }
    }

    private async setupGitRepository(sourceIsGitRepo: boolean, sourcePath: string): Promise<string | undefined> {
        let url: string | undefined;
        const isAlreadyGitRepo = await this.isRepositoryInitialized();

        if (isAlreadyGitRepo) {
            this.loggerService.info(`Git repository already exists in ${BASE_DIR}`);

            if (sourceIsGitRepo) url = await this.copyRemoteConfiguration(sourcePath);
        } else {
            this.loggerService.info(`Initializing new git repository in ${BASE_DIR}`);

            if (!this.git) {
                await fs.ensureDir(BASE_DIR);
                this.git = simpleGit(BASE_DIR);
                await this.git.init();
            } else {
                await this.getGitInstance().init();
            }

            if (sourceIsGitRepo) url = await this.copyRemoteConfiguration(sourcePath);
        }
        return url;
    }

    private async copyRemoteConfiguration(sourcePath: string): Promise<string | undefined> {
        let url: string | undefined;

        try {
            const sourceGit = simpleGit(sourcePath);
            const sourceRemotes = await sourceGit.getRemotes(true);
            const originRemote = sourceRemotes.find((r) => r.name === 'origin');

            if (originRemote) {
                url = originRemote.refs.fetch;
                const git = this.getGitInstance();
                const remotes = await git.getRemotes(true);

                if (remotes.some((r) => r.name === 'origin')) {
                    await git.remote(['set-url', 'origin', url]);
                    this.loggerService.info(`Updated 'origin' remote to ${url}`);
                } else {
                    await git.addRemote('origin', url);
                    this.loggerService.info(`Added 'origin' remote pointing to ${url}`);
                }
            }
        } catch (error) {
            this.errorService.handleError(error, 'copying remote configuration');
        }
        return url;
    }

    public async hasLibraryRepositoryChanges(): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.success(false);

            const useGitResult = this.configService.getConfigValue('USE_GIT');
            const useGit = useGitResult.success ? useGitResult.data : true;

            if (!useGit) return Result.success(false);

            if (!(await this.isRepositoryInitialized())) return Result.success(false);

            const git = this.getGitInstance();
            const status = await git.status();
            const contentChanges = status.files.filter(
                (file) => file.path.startsWith('prompts/') || file.path.startsWith('fragments/')
            );
            return Result.success(contentChanges.length > 0);
        } catch (error) {
            this.loggerService.error('Error checking for repository changes:', error);
            return Result.failure(`Error checking changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async getLibraryRepositoryChanges(): Promise<ApiResult<{ path: string; status: string }[]>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.success([]);

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.success([]);

            if (!(await this.isRepositoryInitialized())) return Result.success([]);

            const git = this.getGitInstance();
            const status: StatusResult = await git.status();
            const changes = status.files
                .filter((file) => file.path.startsWith('prompts/') || file.path.startsWith('fragments/'))
                .map((file) => ({
                    path: file.path,
                    status: file.index === '?' ? '?' : file.working_dir
                }));
            return Result.success(changes);
        } catch (error) {
            this.loggerService.error('Error getting repository changes:', error);
            return Result.failure(`Error getting changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async stageAllChanges(): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            await git.add(['prompts/', 'fragments/']);
            this.loggerService.info('Staged changes in prompts/ and fragments/ directories.');
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error staging changes:', error);
            return Result.failure(`Error staging changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async stagePromptChanges(promptDirectory: string): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const promptPath = path.join('prompts', promptDirectory);
            const promptFullPath = path.join(BASE_DIR, promptPath);

            if (!(await fs.pathExists(promptFullPath))) {
                return Result.failure(`Prompt directory ${promptDirectory} not found`);
            }

            this.loggerService.info(`Staging changes for prompt directory: ${promptPath}`);
            await git.add(promptPath);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error staging prompt changes:', error);
            return Result.failure(
                `Error staging prompt changes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async stageFragmentChanges(fragmentCategory: string, fragmentName?: string): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const fragmentPath = fragmentName
                ? path.join('fragments', fragmentCategory, `${fragmentName}.md`)
                : path.join('fragments', fragmentCategory);
            const fragmentFullPath = path.join(BASE_DIR, fragmentPath);

            if (!(await fs.pathExists(fragmentFullPath))) {
                this.loggerService.warn(`Fragment path ${fragmentPath} not found for staging.`);
                return Result.success(true);
            }

            this.loggerService.info(`Staging changes for fragment path: ${fragmentPath}`);
            await git.add(fragmentPath);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error staging fragment changes:', error);
            return Result.failure(
                `Error staging fragment changes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async commitChanges(message: string): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            await git.commit(message);
            this.loggerService.info(`Committed changes with message: "${message}"`);
            return Result.success(true);
        } catch (error) {
            if (error instanceof Error && error.message.includes('nothing to commit')) {
                this.loggerService.info('No changes staged to commit.');
                return Result.success(true);
            }

            this.loggerService.error('Error committing changes:', error);
            return Result.failure(
                `Error committing changes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async pushChanges(branch?: string): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const remotes = await git.getRemotes(true);

            if (remotes.length === 0) return Result.failure('No remote repository configured');

            const remoteName = 'origin';
            const branchName = branch || (await git.revparse(['--abbrev-ref', 'HEAD']));
            this.loggerService.info(`Pushing branch '${branchName}' to remote '${remoteName}'...`);
            await git.push(remoteName, branchName);
            this.loggerService.info(`Push successful.`);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error pushing changes:', error);
            return Result.failure(`Error pushing changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async getFormattedDiff(): Promise<ApiResult<string>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git integration is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            await git
                .add(['prompts/', 'fragments/'])
                .catch((e) =>
                    this.loggerService.warn(
                        `Minor error during staging for diff: ${e instanceof Error ? e.message : String(e)}`
                    )
                );
            const diffResult = await git.diff(['--cached']);

            if (!diffResult || diffResult.trim() === '') {
                const unstagedDiff = await git.diff(['prompts/', 'fragments/']);

                if (!unstagedDiff || unstagedDiff.trim() === '') {
                    return Result.success('No changes detected in prompts or fragments');
                }
                return Result.success(unstagedDiff);
            }
            return Result.success(diffResult);
        } catch (error) {
            this.loggerService.error('Error getting formatted diff:', error);
            return Result.failure(`Error getting diff: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async hasRemote(remoteName: string): Promise<ApiResult<boolean>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.success(false);

            const git = this.getGitInstance();
            const remotes = await git.getRemotes(true);
            return Result.success(remotes.some((remote) => remote.name === remoteName));
        } catch (error) {
            this.loggerService.error('Error checking git remotes:', error);
            return Result.failure(
                `Error checking git remotes: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async addRemote(name: string, url: string): Promise<ApiResult<boolean>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Repository not initialized');

            const git = this.getGitInstance();
            await git.addRemote(name, url);
            this.loggerService.info(`Added remote '${name}' pointing to ${url}`);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error adding remote:', error);
            return Result.failure(`Error adding remote: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async cloneRepository(url: string): Promise<ApiResult<boolean>> {
        try {
            await simpleGit().clone(url, BASE_DIR);
            this.loggerService.info(`Cloned repository from ${url} into ${BASE_DIR}`);
            await this.onModuleInit();
            await this.ensureGitignore();
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error cloning repository:', error);
            return Result.failure(
                `Error cloning repository: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async initRepository(): Promise<ApiResult<SimpleGit>> {
        try {
            await fs.ensureDir(BASE_DIR);

            if (!this.git) {
                await fs.ensureDir(BASE_DIR);
                this.git = simpleGit(BASE_DIR);
                await this.git.init();
            } else {
                await this.getGitInstance().init();
            }

            this.loggerService.info(`Initialized empty Git repository in ${BASE_DIR}`);
            await this.ensureGitignore();
            return Result.success(this.git);
        } catch (error) {
            this.loggerService.error('Error initializing repository:', error);
            return Result.failure(
                `Error initializing repository: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async ensureGitignore(): Promise<void> {
        const gitignorePath = path.join(BASE_DIR, '.gitignore');
        const gitignoreContent = `
# Prompt Library CLI .gitignore
.config/
coverage/
dist/
node_modules/
temp/
temp_types/
*.db
*.sqlite
*.sqlite3
.env
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.idea/
.vscode/
*.swp
*.swo
.DS_Store
`;

        try {
            if (await fs.pathExists(gitignorePath)) {
                const existingContent = await fs.readFile(gitignorePath, 'utf-8');

                if (!existingContent.includes('.config/') || !existingContent.includes('*.sqlite')) {
                    await fs.appendFile(gitignorePath, gitignoreContent);
                    this.loggerService.info('Updated .gitignore file');
                }
            } else {
                await fs.writeFile(gitignorePath, gitignoreContent.trim() + '\n');
                this.loggerService.info('Created .gitignore file');
            }
        } catch (error) {
            this.errorService.handleError(error, 'updating .gitignore file');
        }
    }

    public async pushChangesToRemote(branch?: string, commitMessage?: string): Promise<ApiResult<boolean>> {
        try {
            const setupResult = await this.isLibraryRepositorySetup();

            if (!setupResult.success || !setupResult.data) return Result.failure('Repository not set up');

            const useGitResult = this.configService.getConfigValue('USE_GIT');

            if (!useGitResult.success || !useGitResult.data) return Result.failure('Git integration is disabled');

            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const upstreamRepoResult = this.configService.getConfigValue('REMOTE_REPOSITORY');
            const upstreamRepo = upstreamRepoResult.success ? upstreamRepoResult.data : '';
            const defaultBranchResult = this.configService.getConfigValue('DEFAULT_BRANCH');
            const defaultBranch =
                defaultBranchResult.success && defaultBranchResult.data ? defaultBranchResult.data : 'main';
            const branchName = branch || defaultBranch;

            if (!branchName) return Result.failure('Target branch name could not be determined.');

            if (!upstreamRepo) return Result.failure('No remote repository configured');

            const git = this.getGitInstance();
            const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);

            if (currentBranch !== branchName) {
                const branches = await git.branchLocal();

                if (branches.all.includes(branchName)) {
                    await git.checkout(branchName);
                    this.loggerService.info(`Switched to branch: ${branchName}`);
                } else {
                    await git.checkoutLocalBranch(branchName);
                    this.loggerService.info(`Created new branch: ${branchName}`);
                }
            }

            const statusResult = await this.getLibraryRepositoryChanges();

            if (statusResult.success && statusResult.data && statusResult.data.length > 0) {
                await git.add(['prompts/', 'fragments/']);
                this.loggerService.info('Staged changes in prompts/ and fragments/.');
                const stagedStatus = await git.status();

                if (stagedStatus.staged.length > 0) {
                    const message = commitMessage || `Update prompts/fragments [${new Date().toISOString()}] via CLI`;
                    await git.commit(message);
                    this.loggerService.info(`Committed changes: "${message}"`);
                } else {
                    this.loggerService.info('No changes staged to commit.');
                }
            } else {
                this.loggerService.info('No content changes to commit.');
            }

            const remotes = await git.getRemotes(true);

            if (!remotes.some((r) => r.name === 'origin')) {
                await git.addRemote('origin', upstreamRepo);
                this.loggerService.info(`Added origin remote: ${upstreamRepo}`);
            } else {
                const origin = remotes.find((r) => r.name === 'origin');

                if (origin?.refs?.push !== upstreamRepo || origin?.refs?.fetch !== upstreamRepo) {
                    this.loggerService.warn(`Origin remote URL differs from config. Updating remote URL.`);
                    await git.remote(['set-url', 'origin', upstreamRepo]);
                }
            }

            this.loggerService.info(`Pushing branch '${branchName}' to remote 'origin'...`);
            await git.push('origin', branchName, ['--set-upstream']);
            this.loggerService.info(`Push successful to ${upstreamRepo}.`);
            return Result.success(true);
        } catch (error) {
            this.loggerService.error('Error pushing changes to remote:', error);
            return Result.failure(`Error pushing changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async fetchFromRemote(repoUrl?: string): Promise<ApiResult<void>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const urlToUseResult = this.configService.getConfigValue('REMOTE_REPOSITORY');
            const urlToUse = repoUrl || (urlToUseResult.success ? urlToUseResult.data : '');
            const remotes = await git.getRemotes(true);
            const hasOrigin = remotes.some((r) => r.name === 'origin');

            if (!hasOrigin && urlToUse) {
                await git.addRemote('origin', urlToUse);
                this.loggerService.info(`Added remote 'origin' pointing to ${urlToUse}`);
            } else if (!hasOrigin && !urlToUse) {
                return Result.failure('No remote repository configured and no URL provided');
            } else if (urlToUse) {
                const origin = remotes.find((r) => r.name === 'origin');

                if (origin?.refs?.push !== urlToUse || origin?.refs?.fetch !== urlToUse) {
                    this.loggerService.debug(`Updating origin remote URL to ${urlToUse}`);
                    await git.remote(['set-url', 'origin', urlToUse]);
                }
            } else {
                this.loggerService.debug('Fetching existing origin remote.');
            }

            await git.fetch('origin');
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error(`Error fetching from remote: ${error}`);
            return Result.failure(
                `Failed to fetch from remote: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async pullChanges(branch: string = 'main'): Promise<ApiResult<boolean>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const remotes = await git.getRemotes(true);

            if (!remotes.some((r) => r.name === 'origin')) {
                return Result.failure('No remote repository configured');
            }

            await git.pull('origin', branch);
            return Result.success(true);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Already up to date')) {
                this.loggerService.info('Repository is already up to date.');
                return Result.success(false);
            }

            this.errorService.handleError(error, 'pulling changes');
            return Result.failure(`Pull failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async getRemoteDiff(branch: string = 'main'): Promise<ApiResult<string>> {
        try {
            if (!(await this.isRepositoryInitialized())) return Result.failure('Git not initialized');

            const git = this.getGitInstance();
            const remotes = await git.getRemotes(true);

            if (!remotes.some((r) => r.name === 'origin')) {
                return Result.failure('No remote repository configured');
            }

            await git.fetch('origin');
            const diff = await git.diff([`HEAD..origin/${branch}`, '--', 'prompts/', 'fragments/']);
            return Result.success(diff);
        } catch (error) {
            this.loggerService.error(`Error getting remote diff: ${error}`);
            return Result.failure(
                `Failed to get remote diff: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
