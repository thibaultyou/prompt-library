import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { CommonInfrastructureModule } from './common/common-infrastructure.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ErrorModule } from './error/error.module';
import { FileSystemModule } from './file-system/file-system.module';
import { LoggerModule } from './logger/logger.module';
import { ModelModule } from './model/model.module';
import { RepositoryModule } from './repository/repository.module';
import { SyncModule } from './sync/sync.module';
import { UiModule } from './ui/ui.module';

@Module({
    imports: [
        AiModule,
        CommonInfrastructureModule,
        ConfigModule,
        DatabaseModule,
        ErrorModule,
        FileSystemModule,
        LoggerModule,
        ModelModule,
        RepositoryModule,
        SyncModule,
        UiModule
    ],
    exports: [
        AiModule,
        CommonInfrastructureModule,
        ConfigModule,
        DatabaseModule,
        ErrorModule,
        FileSystemModule,
        LoggerModule,
        ModelModule,
        RepositoryModule,
        SyncModule,
        UiModule
    ]
})
export class InfrastructureModule {}
