import { Module, forwardRef } from '@nestjs/common';

import { ConversationService } from './services/conversation.service';
import { ExecutionService } from './services/execution.service';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { CommonInfrastructureModule } from '../../infrastructure/common/common-infrastructure.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { LoggerModule } from '../../infrastructure/logger/logger.module';
import { UiModule } from '../../infrastructure/ui/ui.module';
import { PromptModule } from '../prompt/prompt.module';

@Module({
    imports: [
        forwardRef(() => PromptModule),
        forwardRef(() => AiModule),
        forwardRef(() => CommonInfrastructureModule),
        forwardRef(() => UiModule),
        forwardRef(() => LoggerModule),
        forwardRef(() => DatabaseModule)
    ],
    providers: [ConversationService, ExecutionService],
    exports: [ConversationService, ExecutionService]
})
export class ExecutionModule {}
