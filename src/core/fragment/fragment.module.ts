import { Module, forwardRef } from '@nestjs/common';

import { FragmentService } from './services/fragment.service';
import { CommonInfrastructureModule } from '../../infrastructure/common/common-infrastructure.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ErrorModule } from '../../infrastructure/error/error.module';
import { LoggerModule } from '../../infrastructure/logger/logger.module';

@Module({
    imports: [
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule),
        forwardRef(() => CommonInfrastructureModule),
        forwardRef(() => DatabaseModule)
    ],
    providers: [FragmentService],
    exports: [FragmentService]
})
export class FragmentModule {}
