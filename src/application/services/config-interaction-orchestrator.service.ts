import { Injectable, Scope } from '@nestjs/common';

import { ConfigCommandService } from './config-command.service';
import { FlushCommandService } from '../../infrastructure/database/services/flush.service';
import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { CONFIG_UI } from '../../shared/constants';
import { CommandInterface, ConfigCommandAction } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ConfigInteractionOrchestratorService {
    constructor(
        private readonly uiFacade: UiFacade,
        private readonly loggerService: LoggerService,
        private readonly errorService: ErrorService,
        private readonly configCommandService: ConfigCommandService,
        private readonly flushCommandService: FlushCommandService
    ) {}

    public async startConfigInteractionWorkflow(command: CommandInterface): Promise<void> {
        while (true) {
            try {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(CONFIG_UI.SECTION_HEADER.TITLE, CONFIG_UI.SECTION_HEADER.ICON);
                const action = await command.selectMenu<ConfigCommandAction>(CONFIG_UI.MENU.PROMPT, [
                    { name: CONFIG_UI.MENU.OPTIONS.VIEW, value: CONFIG_UI.ACTIONS.VIEW },
                    { name: CONFIG_UI.MENU.OPTIONS.SET, value: CONFIG_UI.ACTIONS.SET },
                    this.uiFacade.formatMenuItem(
                        CONFIG_UI.MENU.OPTIONS.FLUSH,
                        CONFIG_UI.ACTIONS.FLUSH,
                        CONFIG_UI.STYLES.FLUSH
                    ),
                    this.uiFacade.formatMenuItem(
                        CONFIG_UI.MENU.OPTIONS.RESET,
                        CONFIG_UI.ACTIONS.RESET,
                        CONFIG_UI.STYLES.RESET
                    )
                ]);

                if (action === CONFIG_UI.ACTIONS.BACK) return;

                await this.handleMenuAction(action, command);
            } catch (error) {
                this.errorService.handleCommandError(error, 'config interaction workflow');
                await command.pressKeyToContinue();
            }
        }
    }

    private async handleMenuAction(action: ConfigCommandAction, command: CommandInterface): Promise<void> {
        switch (action) {
            case CONFIG_UI.ACTIONS.VIEW: {
                this.configCommandService.viewConfig();
                await command.pressKeyToContinue();
                break;
            }
            case CONFIG_UI.ACTIONS.SET: {
                await this.configCommandService.editConfigMenu(command);
                break;
            }
            case CONFIG_UI.ACTIONS.FLUSH: {
                const confirmResult = await this.flushCommandService.confirmFlush(command);

                if (confirmResult.success && confirmResult.data) {
                    await this.flushCommandService.performFlush();
                } else {
                    this.loggerService.warn('Flush cancelled or confirmation failed.');
                    await command.pressKeyToContinue();
                }

                break;
            }
            case CONFIG_UI.ACTIONS.RESET: {
                this.configCommandService.resetConfig();
                await command.pressKeyToContinue();
                break;
            }
        }
    }
}
