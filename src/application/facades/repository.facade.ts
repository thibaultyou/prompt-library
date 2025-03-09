import { Injectable, Scope } from '@nestjs/common';
import { SimpleGit } from 'simple-git';

import { RepositoryService } from '../../infrastructure/repository/services/repository.service';
import { ApiResult } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class RepositoryFacade {
    constructor(private readonly repositoryService: RepositoryService) {}

    public async isLibraryRepositorySetup(): Promise<ApiResult<boolean>> {
        return this.repositoryService.isLibraryRepositorySetup();
    }
    public getLibraryPromptPath(promptDirectory: string): string {
        return this.repositoryService.getLibraryPromptPath(promptDirectory);
    }
    public getLibraryFragmentPath(fragmentCategory: string, fragmentName: string): string {
        return this.repositoryService.getLibraryFragmentPath(fragmentCategory, fragmentName);
    }
    public async hasLibraryRepositoryChanges(): Promise<ApiResult<boolean>> {
        return this.repositoryService.hasLibraryRepositoryChanges();
    }
    public async countPendingChanges(): Promise<ApiResult<number>> {
        return this.repositoryService.countPendingChanges();
    }
    public async getRepositoryInfo(): Promise<ApiResult<{ branch?: string; url?: string }>> {
        return this.repositoryService.getRepositoryInfo();
    }
    public async getCurrentBranch(): Promise<ApiResult<string>> {
        return this.repositoryService.getCurrentBranch();
    }
    public async getRepoBranches(): Promise<ApiResult<string[]>> {
        return this.repositoryService.getRepoBranches();
    }
    public async createAndCheckoutBranch(branchName: string): Promise<ApiResult<void>> {
        return this.repositoryService.createAndCheckoutBranch(branchName);
    }
    public async checkoutBranch(branchName: string): Promise<ApiResult<void>> {
        return this.repositoryService.checkoutBranch(branchName);
    }
    public async setupFromRemoteUrl(remoteUrl: string): Promise<ApiResult<string>> {
        return this.repositoryService.setupFromRemoteUrl(remoteUrl);
    }
    public async setupFromLocalDirectory(localDir: string): Promise<ApiResult<{ path: string; url?: string }>> {
        return this.repositoryService.setupFromLocalDirectory(localDir);
    }
    public async getLibraryRepositoryChanges(): Promise<ApiResult<{ path: string; status: string }[]>> {
        return this.repositoryService.getLibraryRepositoryChanges();
    }
    public async stageAllChanges(): Promise<ApiResult<boolean>> {
        return this.repositoryService.stageAllChanges();
    }
    public async stagePromptChanges(promptDirectory: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.stagePromptChanges(promptDirectory);
    }
    public async commitChanges(message: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.commitChanges(message);
    }
    public async pushChanges(branch?: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.pushChanges(branch);
    }
    public async getFormattedDiff(): Promise<ApiResult<string>> {
        return this.repositoryService.getFormattedDiff();
    }
    public async pushChangesToRemote(branch?: string, commitMessage?: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.pushChangesToRemote(branch, commitMessage);
    }
    public async hasRemote(remoteName: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.hasRemote(remoteName);
    }
    public async addRemote(name: string, url: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.addRemote(name, url);
    }
    public async cloneRepository(url: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.cloneRepository(url);
    }
    public async initRepository(): Promise<ApiResult<SimpleGit>> {
        return this.repositoryService.initRepository();
    }
    public async stageFragmentChanges(fragmentCategory: string, fragmentName?: string): Promise<ApiResult<boolean>> {
        return this.repositoryService.stageFragmentChanges(fragmentCategory, fragmentName);
    }
}
