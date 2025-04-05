import { Module, forwardRef } from '@nestjs/common';

import { FileSystemService } from './services/file-system.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [forwardRef(() => LoggerModule)],
    providers: [FileSystemService],
    exports: [FileSystemService]
})
export class FileSystemModule {}
