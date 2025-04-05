import { Module, forwardRef } from '@nestjs/common';

import { DatabaseRepository } from './repositories/database.repository';
import { SqliteFragmentRepository } from './repositories/sqlite-fragment.repository';
import { SqlitePromptExecutionRepository } from './repositories/sqlite-prompt-execution.repository';
import { SqlitePromptFavoriteRepository } from './repositories/sqlite-prompt-favorite.repository';
import { SqlitePromptMetadataRepository } from './repositories/sqlite-prompt-metadata.repository';
import { SqlitePromptSyncRepository } from './repositories/sqlite-prompt-sync.repository';
import { SqlitePromptRepository } from './repositories/sqlite-prompt.repository';
import { SqliteVariableRepository } from './repositories/sqlite-variable.repository';
import { DatabaseService } from './services/database.service';
import { FlushCommandService } from './services/flush.service';
import { IFragmentRepository } from '../../core/fragment/repositories/fragment.repository.interface';
import { IPromptExecutionRepository } from '../../core/prompt/repositories/prompt-execution.repository.interface';
import { IPromptFavoriteRepository } from '../../core/prompt/repositories/prompt-favorite.repository.interface';
import { IPromptMetadataRepository } from '../../core/prompt/repositories/prompt-metadata.repository.interface';
import { IPromptSyncRepository } from '../../core/prompt/repositories/prompt-sync.repository.interface';
import { IPromptRepository } from '../../core/prompt/repositories/prompt.repository.interface';
import { IVariableRepository } from '../../core/variable/repositories/variable.repository.interface';
import { CommonInfrastructureModule } from '../common/common-infrastructure.module';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule),
        forwardRef(() => CommonInfrastructureModule)
    ],
    providers: [
        DatabaseRepository,
        DatabaseService,
        FlushCommandService,
        SqliteFragmentRepository,
        SqlitePromptRepository,
        SqlitePromptMetadataRepository,
        SqlitePromptExecutionRepository,
        SqlitePromptFavoriteRepository,
        SqlitePromptSyncRepository,
        SqliteVariableRepository,
        { provide: IFragmentRepository, useExisting: SqliteFragmentRepository },
        { provide: IPromptRepository, useExisting: SqlitePromptRepository },
        { provide: IPromptMetadataRepository, useExisting: SqlitePromptMetadataRepository },
        { provide: IPromptExecutionRepository, useExisting: SqlitePromptExecutionRepository },
        { provide: IPromptFavoriteRepository, useExisting: SqlitePromptFavoriteRepository },
        { provide: IPromptSyncRepository, useExisting: SqlitePromptSyncRepository },
        { provide: IVariableRepository, useExisting: SqliteVariableRepository }
    ],
    exports: [
        DatabaseService,
        DatabaseRepository,
        FlushCommandService,
        IFragmentRepository,
        IPromptRepository,
        IPromptMetadataRepository,
        IPromptExecutionRepository,
        IPromptFavoriteRepository,
        IPromptSyncRepository,
        IVariableRepository
    ]
})
export class DatabaseModule {}
