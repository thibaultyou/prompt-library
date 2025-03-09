import { Module, forwardRef } from '@nestjs/common';

import { AIClientProvider } from './services/ai-client.provider';
import { AnthropicClient } from './services/anthropic.client';
import { OpenAIClient } from './services/openai.client';
import { AI_CLIENT_TOKEN } from '../../shared/types';
import { ConfigModule } from '../config/config.module';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [forwardRef(() => ConfigModule), forwardRef(() => LoggerModule), forwardRef(() => ErrorModule)],
    providers: [AnthropicClient, OpenAIClient, AIClientProvider],
    exports: [AI_CLIENT_TOKEN]
})
export class AiModule {}
