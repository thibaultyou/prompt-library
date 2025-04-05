import { Module, forwardRef } from '@nestjs/common';

import { ModelService } from './services/model.service';
import { AiModule } from '../ai/ai.module';
import { AnthropicClient } from '../ai/services/anthropic.client';
import { OpenAIClient } from '../ai/services/openai.client';
import { ConfigModule } from '../config/config.module';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [
        forwardRef(() => AiModule),
        forwardRef(() => ConfigModule),
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule)
    ],
    providers: [ModelService, AnthropicClient, OpenAIClient],
    exports: [ModelService]
})
export class ModelModule {}
