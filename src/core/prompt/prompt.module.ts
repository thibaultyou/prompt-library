import { Module, forwardRef } from '@nestjs/common';

import { IPromptServiceToken } from './interfaces/prompt.service.interface';
import { CategoryService } from './services/category.service';
import { PromptAnalysisService } from './services/prompt-analysis.service';
import { PromptVariableService } from './services/prompt-variable.service';
import { PromptService } from './services/prompt.service';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { CommonInfrastructureModule } from '../../infrastructure/common/common-infrastructure.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ErrorModule } from '../../infrastructure/error/error.module';
import { LoggerModule } from '../../infrastructure/logger/logger.module';
import { UiModule } from '../../infrastructure/ui/ui.module';
import { FragmentModule } from '../fragment/fragment.module';
import { VariableModule } from '../variable/variable.module';

@Module({
    imports: [
        forwardRef(() => FragmentModule),
        forwardRef(() => LoggerModule),
        forwardRef(() => CommonInfrastructureModule),
        forwardRef(() => UiModule),
        forwardRef(() => DatabaseModule),
        forwardRef(() => ErrorModule),
        forwardRef(() => AiModule),
        forwardRef(() => VariableModule)
    ],
    providers: [
        CategoryService,
        PromptAnalysisService,
        PromptVariableService,
        PromptService,
        {
            provide: IPromptServiceToken,
            useExisting: PromptService
        }
    ],
    exports: [CategoryService, PromptAnalysisService, PromptVariableService, PromptService, IPromptServiceToken]
})
export class PromptModule {}
