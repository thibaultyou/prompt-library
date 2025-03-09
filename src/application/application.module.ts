import { Module, forwardRef } from '@nestjs/common';

import { BootstrapModule } from './bootstrap/bootstrap.module';
import { CommandsModule } from './commands/commands.module';
import { FacadeModule } from './facades/facades.module';
import { ServicesModule } from './services/services.module';
import { CoreModule } from '../core/core.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({
    imports: [
        forwardRef(() => CoreModule),
        forwardRef(() => InfrastructureModule),
        forwardRef(() => FacadeModule),
        forwardRef(() => ServicesModule),
        forwardRef(() => CommandsModule),
        forwardRef(() => BootstrapModule)
    ]
})
export class ApplicationModule {}
