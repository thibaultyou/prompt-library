import { Module, forwardRef } from '@nestjs/common';

import { CliInitializationService } from './cli-initialization.service';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { FacadeModule } from '../facades/facades.module';

@Module({
    imports: [forwardRef(() => FacadeModule), forwardRef(() => InfrastructureModule)],
    providers: [CliInitializationService],
    exports: [CliInitializationService]
})
export class BootstrapModule {}
