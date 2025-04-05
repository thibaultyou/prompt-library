import { Module, forwardRef } from '@nestjs/common';

import { MenuBuilder } from './components/menu.builder';
import { PromptTableRenderer } from './components/prompt-table.renderer';
import { TableRenderer } from './components/table.renderer';
import { TextFormatter } from './components/text.formatter';
import { VariableTableRenderer } from './components/variable-table.renderer';
import { ConsoleFacade } from './facades/console.facade';
import { EditorFacade } from './facades/editor.facade';
import { UiFacade } from './facades/ui.facade';
import { ConsoleService } from './services/console.service';
import { EditorService } from './services/editor.service';
import { CommonInfrastructureModule } from '../common/common-infrastructure.module';
import { ErrorModule } from '../error/error.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [
        forwardRef(() => CommonInfrastructureModule),
        forwardRef(() => LoggerModule),
        forwardRef(() => ErrorModule)
    ],
    providers: [
        ConsoleService,
        EditorService,
        TextFormatter,
        MenuBuilder,
        TableRenderer,
        PromptTableRenderer,
        VariableTableRenderer,
        ConsoleFacade,
        EditorFacade,
        UiFacade
    ],
    exports: [
        ConsoleFacade,
        EditorFacade,
        UiFacade,
        TextFormatter,
        MenuBuilder,
        TableRenderer,
        PromptTableRenderer,
        VariableTableRenderer,
        EditorService
    ]
})
export class UiModule {}
