import { Module, forwardRef } from '@nestjs/common';

import { RepositoryService } from './services/repository.service';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [
        forwardRef(() => DatabaseModule),
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule),
        forwardRef(() => ConfigModule)
    ],
    providers: [RepositoryService],
    exports: [RepositoryService]
})
export class RepositoryModule {}
