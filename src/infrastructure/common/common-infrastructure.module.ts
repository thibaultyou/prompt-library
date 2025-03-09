import { Module, forwardRef } from '@nestjs/common';

import { HashService } from './services/hash.service';
import { StringFormatterService } from './services/string-formatter.service';
import { YamlOperationsService } from './services/yaml-operations.service';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [forwardRef(() => LoggerModule), forwardRef(() => ErrorModule)],
    providers: [StringFormatterService, YamlOperationsService, HashService],
    exports: [StringFormatterService, YamlOperationsService, HashService]
})
export class CommonInfrastructureModule {}
