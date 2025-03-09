import { Module, forwardRef } from '@nestjs/common';

import { ConfigCommandService } from './config-command.service';
import { ConfigInteractionOrchestratorService } from './config-interaction-orchestrator.service';
import { DocumentationService } from './documentation.service';
import { EnvCommandService } from './env-command.service';
import { EnvInteractionOrchestratorService } from './env-interaction-orchestrator.service';
import { ExecuteCommandService } from './execution-command.service';
import { FragmentCommandService } from './fragment-command.service';
import { FragmentInteractionOrchestratorService } from './fragment-interaction-orchestrator.service';
import { InputResolverService } from './input-resolver.service';
import { MenuCommandService } from './menu-command.service';
import { ModelCommandService } from './model-command.service';
import { PromptInteractionOrchestratorService } from './prompt-interaction-orchestrator.service';
import { PromptInteractionService } from './prompt-interaction.service';
import { RepositoryCommandService } from './repository-command.service';
import { SetupCommandService } from './setup-command.service';
import { SyncCommandService } from './sync-command.service';
import { CoreModule } from '../../core/core.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { CommandsModule } from '../commands/commands.module';
import { FacadeModule } from '../facades/facades.module';

@Module({
    imports: [
        forwardRef(() => FacadeModule),
        forwardRef(() => CoreModule),
        forwardRef(() => InfrastructureModule),
        forwardRef(() => CommandsModule)
    ],
    providers: [
        ConfigCommandService,
        EnvCommandService,
        ExecuteCommandService,
        FragmentCommandService,
        ModelCommandService,
        PromptInteractionService,
        RepositoryCommandService,
        SyncCommandService,
        MenuCommandService,
        InputResolverService,
        SetupCommandService,
        DocumentationService,
        PromptInteractionOrchestratorService,
        FragmentInteractionOrchestratorService,
        EnvInteractionOrchestratorService,
        ConfigInteractionOrchestratorService
    ],
    exports: [
        ConfigCommandService,
        EnvCommandService,
        ExecuteCommandService,
        FragmentCommandService,
        ModelCommandService,
        PromptInteractionService,
        RepositoryCommandService,
        SyncCommandService,
        MenuCommandService,
        InputResolverService,
        SetupCommandService,
        DocumentationService,
        PromptInteractionOrchestratorService,
        FragmentInteractionOrchestratorService,
        EnvInteractionOrchestratorService,
        ConfigInteractionOrchestratorService
    ]
})
export class ServicesModule {}
