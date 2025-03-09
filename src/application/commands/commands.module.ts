import { Module, forwardRef } from '@nestjs/common';

import { ConfigCommand } from './config/config.command';
import { GenerateDocsCommand } from './docs/generate-docs.command';
import { CreateEnvCommand } from './env/create-env.command';
import { DeleteEnvCommand } from './env/delete-env.command';
import { EnvCommand } from './env/env.command';
import { ListEnvCommand } from './env/list-env.command';
import { ReadEnvCommand } from './env/read-env.command';
import { UpdateEnvCommand } from './env/update-env.command';
import { ExecuteCommand } from './execute/execute.command';
import { FlushCommand } from './flush/flush.command';
import { CreateFragmentCommand } from './fragment/create-fragment.command';
import { DeleteFragmentCommand } from './fragment/delete-fragment.command';
import { FragmentCommand } from './fragment/fragment.command';
import { ListFragmentCommand } from './fragment/list-fragment.command';
import { ReadFragmentCommand } from './fragment/read-fragment.command';
import { SearchFragmentCommand } from './fragment/search-fragment.command';
import { UpdateFragmentCommand } from './fragment/update-fragment.command';
import { MenuCommand } from './menu/menu.command';
import { ModelCommand } from './model/model.command';
import { CreatePromptCommand } from './prompt/create-prompt.command';
import { DeletePromptCommand } from './prompt/delete-prompt.command';
import { FavoritesPromptCommand } from './prompt/favorites-prompt.command';
import { ListPromptCommand } from './prompt/list-prompt.command';
import { PromptCommand } from './prompt/prompt.command';
import { ReadPromptCommand } from './prompt/read-prompt.command';
import { RecentPromptCommand } from './prompt/recent-prompt.command';
import { RefreshPromptMetadataCommand } from './prompt/refresh-prompt-metadata.command';
import { SearchPromptCommand } from './prompt/search-prompt.command';
import { UpdatePromptCommand } from './prompt/update-prompt.command';
import { RepositoryCommand } from './repository/repository.command';
import { SetupCommand } from './setup/setup.command';
import { SyncCommand } from './sync/sync.command';
import { CoreModule } from '../../core/core.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { FacadeModule } from '../facades/facades.module';
import { ServicesModule } from '../services/services.module';

@Module({
    imports: [
        forwardRef(() => ServicesModule),
        forwardRef(() => FacadeModule),
        forwardRef(() => InfrastructureModule),
        forwardRef(() => CoreModule)
    ],
    providers: [
        ConfigCommand,
        EnvCommand,
        ExecuteCommand,
        FlushCommand,
        FragmentCommand,
        MenuCommand,
        ModelCommand,
        PromptCommand,
        RepositoryCommand,
        SetupCommand,
        SyncCommand,
        GenerateDocsCommand,
        CreateEnvCommand,
        DeleteEnvCommand,
        ListEnvCommand,
        ReadEnvCommand,
        UpdateEnvCommand,
        CreateFragmentCommand,
        DeleteFragmentCommand,
        ListFragmentCommand,
        ReadFragmentCommand,
        SearchFragmentCommand,
        UpdateFragmentCommand,
        CreatePromptCommand,
        DeletePromptCommand,
        FavoritesPromptCommand,
        ListPromptCommand,
        ReadPromptCommand,
        RecentPromptCommand,
        RefreshPromptMetadataCommand,
        SearchPromptCommand,
        UpdatePromptCommand
    ],
    exports: [
        ConfigCommand,
        EnvCommand,
        ExecuteCommand,
        FlushCommand,
        FragmentCommand,
        MenuCommand,
        ModelCommand,
        PromptCommand,
        RepositoryCommand,
        SetupCommand,
        SyncCommand,
        GenerateDocsCommand,
        CreateEnvCommand,
        DeleteEnvCommand,
        ListEnvCommand,
        ReadEnvCommand,
        UpdateEnvCommand,
        CreateFragmentCommand,
        DeleteFragmentCommand,
        ListFragmentCommand,
        ReadFragmentCommand,
        SearchFragmentCommand,
        UpdateFragmentCommand,
        CreatePromptCommand,
        DeletePromptCommand,
        FavoritesPromptCommand,
        ListPromptCommand,
        ReadPromptCommand,
        RecentPromptCommand,
        RefreshPromptMetadataCommand,
        SearchPromptCommand,
        UpdatePromptCommand
    ]
})
export class CommandsModule {}
