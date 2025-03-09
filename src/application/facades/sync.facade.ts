import { Injectable, Scope } from '@nestjs/common';

import { SyncService as SyncInfraService } from '../../infrastructure/sync/services/sync.service';
import { ApiResult } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class SyncFacade {
    constructor(private readonly syncInfraService: SyncInfraService) {}

    public async hasRepositoryChanges(): Promise<ApiResult<boolean>> {
        return this.syncInfraService.hasRepositoryChanges();
    }
    public async getRepoUrl(optionUrl?: string): Promise<ApiResult<string>> {
        return this.syncInfraService.getRepoUrl(optionUrl);
    }
    public setRepoUrl(url: string): ApiResult<boolean> {
        return this.syncInfraService.setRepoUrl(url);
    }
    public async fetchFromRemote(repoUrl?: string): Promise<ApiResult<void>> {
        return this.syncInfraService.fetchFromRemote(repoUrl);
    }
    public formatChanges(changes: { path: string; status: string }[], title: string): string {
        return this.syncInfraService.formatChanges(changes, title);
    }
    public async pullFromRemote(branch?: string): Promise<ApiResult<boolean>> {
        return this.syncInfraService.pullFromRemote(branch);
    }
    public async getRemoteDiff(branch?: string): Promise<ApiResult<string>> {
        return this.syncInfraService.getRemoteDiff(branch);
    }
    public async commitAndPushChanges(branch: string, commitMessage: string): Promise<ApiResult<boolean>> {
        return this.syncInfraService.commitAndPushChanges(branch, commitMessage);
    }
}
