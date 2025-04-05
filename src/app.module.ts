import { Module, Logger } from '@nestjs/common';

import { ApplicationModule } from './application/application.module';
import { CoreModule } from './core/core.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { SharedModule } from './shared/shared.module';

@Module({
    imports: [SharedModule, InfrastructureModule, CoreModule, ApplicationModule],
    providers: [Logger]
})
export class AppModule {}
