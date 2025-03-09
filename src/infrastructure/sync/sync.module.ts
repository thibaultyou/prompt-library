import { Module, forwardRef } from '@nestjs/common';

import { SyncService } from './services/sync.service';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';
import { RepositoryModule } from '../repository/repository.module';

@Module({
    imports: [forwardRef(() => RepositoryModule), forwardRef(() => LoggerModule), forwardRef(() => ErrorModule)],
    providers: [SyncService],
    exports: [SyncService]
})
export class SyncModule {}
