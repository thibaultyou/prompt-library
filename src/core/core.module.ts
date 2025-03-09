import { Module, forwardRef } from '@nestjs/common';

import { ExecutionModule } from './execution/execution.module';
import { FragmentModule } from './fragment/fragment.module';
import { PromptModule } from './prompt/prompt.module';
import { VariableModule } from './variable/variable.module';

@Module({
    imports: [
        forwardRef(() => ExecutionModule),
        forwardRef(() => FragmentModule),
        forwardRef(() => PromptModule),
        forwardRef(() => VariableModule)
    ],
    exports: [ExecutionModule, FragmentModule, PromptModule, VariableModule]
})
export class CoreModule {}
