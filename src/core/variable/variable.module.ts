import { Module, forwardRef } from '@nestjs/common';

import { EnvVariableService } from './services/env-variable.service';
import { VariableService } from './services/variable.service';
import { CommonInfrastructureModule } from '../../infrastructure/common/common-infrastructure.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ErrorModule } from '../../infrastructure/error/error.module';
import { LoggerModule } from '../../infrastructure/logger/logger.module';
import { FragmentModule } from '../fragment/fragment.module';

@Module({
    imports: [
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule),
        forwardRef(() => CommonInfrastructureModule),
        forwardRef(() => DatabaseModule),
        forwardRef(() => FragmentModule)
    ],
    providers: [EnvVariableService, VariableService],
    exports: [EnvVariableService, VariableService]
})
export class VariableModule {}
