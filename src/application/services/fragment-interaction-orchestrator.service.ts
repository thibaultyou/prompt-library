import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { FRAGMENT_UI } from '../../shared/constants';
import { CommandInterface, FragmentAction, MenuItem } from '../../shared/types';
import { CreateFragmentCommand } from '../commands/fragment/create-fragment.command';
import { DeleteFragmentCommand } from '../commands/fragment/delete-fragment.command';
import { ListFragmentCommand } from '../commands/fragment/list-fragment.command';
import { ReadFragmentCommand } from '../commands/fragment/read-fragment.command';
import { SearchFragmentCommand } from '../commands/fragment/search-fragment.command';
import { UpdateFragmentCommand } from '../commands/fragment/update-fragment.command';

@Injectable({ scope: Scope.DEFAULT })
export class FragmentInteractionOrchestratorService {
    constructor(
        private readonly uiFacade: UiFacade,
        private readonly loggerService: LoggerService,
        private readonly errorService: ErrorService,
        @Inject(forwardRef(() => ListFragmentCommand)) private readonly listProvider: ListFragmentCommand,
        @Inject(forwardRef(() => SearchFragmentCommand)) private readonly searchProvider: SearchFragmentCommand,
        @Inject(forwardRef(() => CreateFragmentCommand)) private readonly createProvider: CreateFragmentCommand,
        @Inject(forwardRef(() => UpdateFragmentCommand)) private readonly updateProvider: UpdateFragmentCommand,
        @Inject(forwardRef(() => DeleteFragmentCommand)) private readonly deleteProvider: DeleteFragmentCommand,
        @Inject(forwardRef(() => ReadFragmentCommand)) private readonly readProvider: ReadFragmentCommand
    ) {}

    public async startFragmentInteractionWorkflow(command: CommandInterface): Promise<void> {
        while (true) {
            try {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(FRAGMENT_UI.SECTION_HEADER.TITLE, FRAGMENT_UI.SECTION_HEADER.ICON);
                const choices = this.generateMenuChoices();
                const action = await command.selectMenu<FragmentAction>(FRAGMENT_UI.MENU.SELECT_ACTION, choices, {
                    menuType: 'fragment'
                });

                if (action === 'back') return;

                await this.executeSelectedAction(action, command, { json: false, isInteractive: true });
            } catch (error) {
                this.errorService.handleCommandError(error, 'fragment interaction workflow');
                await command.pressKeyToContinue();
            }
        }
    }

    private generateMenuChoices(): Array<MenuItem<FragmentAction>> {
        return [
            {
                name: this.uiFacade.formatMenuItem('🔍 BROWSE FRAGMENTS', 'header', 'primary', true).name,
                value: 'header',
                disabled: true,
                type: 'separator'
            },
            { name: 'View all fragments', value: 'all', type: 'item' },
            { name: 'Browse by category', value: 'category', type: 'item' },
            { name: 'Search fragments', value: 'search', type: 'item' },
            { name: '─'.repeat(50), value: 'separator', disabled: true, type: 'separator' },
            {
                name: this.uiFacade.formatMenuItem('🔧 MANAGE FRAGMENTS', 'header', 'primary', true).name,
                value: 'header',
                disabled: true,
                type: 'separator'
            },
            {
                name: this.uiFacade.formatMenuItem('Create new fragment', 'create', 'success').name,
                value: 'create',
                type: 'item'
            },
            {
                name: this.uiFacade.formatMenuItem('Update fragment', 'update', 'warning').name,
                value: 'update',
                type: 'item'
            },
            { name: 'View fragment details', value: 'read', type: 'item' },
            {
                name: this.uiFacade.formatMenuItem('Delete fragment', 'delete', 'danger').name,
                value: 'delete',
                type: 'item'
            }
        ];
    }

    private async executeSelectedAction(
        action: FragmentAction,
        command: CommandInterface,
        options: { json?: boolean; isInteractive?: boolean } = {}
    ): Promise<void> {
        this.uiFacade.clearConsole();
        const runOptions = { ...options, nonInteractive: !options.isInteractive };

        try {
            switch (action) {
                case 'all':
                    await this.listProvider.run([], { ...runOptions, categories: false });
                    break;
                case 'category':
                case 'categories':
                    await this.listProvider.run([], { ...runOptions, categories: true });
                    break;
                case 'search':
                    await this.searchProvider.run([], runOptions);
                    break;
                case 'create':
                    await this.createProvider.run([], runOptions);
                    break;
                case 'update':
                    await this.updateProvider.run([], runOptions);
                    break;
                case 'delete':
                    await this.deleteProvider.run([], runOptions);
                    break;
                case 'read':
                    await this.readProvider.run([], runOptions);
                    break;
                case 'header':
                case 'separator':
                    return;
                default:
                    this.loggerService.warn(`Unhandled fragment menu action: ${action}`);
                    break;
            }

            //  if (['all', 'category', 'categories', 'search', 'read'].includes(action) && options.isInteractive) {
            //      await command.pressKeyToContinue();
            //  }
        } catch (subCommandError) {
            this.errorService.handleCommandError(subCommandError, `running fragment action: ${action}`);
            await command.pressKeyToContinue();
        }
    }
}
