import { Module, forwardRef } from '@nestjs/common';

import { CategoryFacade } from './category.facade';
import { ConfigFacade } from './config.facade';
import { ConversationFacade } from './conversation.facade';
import { EnvVariableFacade } from './env-variable.facade';
import { ExecutionFacade } from './execution.facade';
import { FragmentFacade } from './fragment.facade';
import { ModelFacade } from './model.facade';
import { PromptFacade } from './prompt.facade';
import { RepositoryFacade } from './repository.facade';
import { SyncFacade } from './sync.facade';
import { VariableFacade } from './variable.facade';
import { CoreModule } from '../../core/core.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';

@Module({
    imports: [forwardRef(() => CoreModule), forwardRef(() => InfrastructureModule)],
    providers: [
        CategoryFacade,
        ConfigFacade,
        ConversationFacade,
        EnvVariableFacade,
        ExecutionFacade,
        FragmentFacade,
        ModelFacade,
        PromptFacade,
        RepositoryFacade,
        SyncFacade,
        VariableFacade
    ],
    exports: [
        CategoryFacade,
        ConfigFacade,
        ConversationFacade,
        EnvVariableFacade,
        ExecutionFacade,
        FragmentFacade,
        ModelFacade,
        PromptFacade,
        RepositoryFacade,
        SyncFacade,
        VariableFacade
    ]
})
export class FacadeModule {}
