import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { CommandInterface, MenuItem, PromptAction } from '../../shared/types';
import { CreatePromptCommand } from '../commands/prompt/create-prompt.command';
import { DeletePromptCommand } from '../commands/prompt/delete-prompt.command';
import { FavoritesPromptCommand } from '../commands/prompt/favorites-prompt.command';
import { ListPromptCommand } from '../commands/prompt/list-prompt.command';
import { ReadPromptCommand } from '../commands/prompt/read-prompt.command';
import { RecentPromptCommand } from '../commands/prompt/recent-prompt.command';
import { RefreshPromptMetadataCommand } from '../commands/prompt/refresh-prompt-metadata.command';
import { SearchPromptCommand } from '../commands/prompt/search-prompt.command';
import { UpdatePromptCommand } from '../commands/prompt/update-prompt.command';

@Injectable({ scope: Scope.DEFAULT })
export class PromptInteractionOrchestratorService {
    constructor(
        private readonly uiFacade: UiFacade,
        private readonly loggerService: LoggerService,
        private readonly errorService: ErrorService,
        @Inject(forwardRef(() => ListPromptCommand)) private readonly listProvider: ListPromptCommand,
        @Inject(forwardRef(() => SearchPromptCommand)) private readonly searchProvider: SearchPromptCommand,
        @Inject(forwardRef(() => RecentPromptCommand)) private readonly recentProvider: RecentPromptCommand,
        @Inject(forwardRef(() => FavoritesPromptCommand)) private readonly favoritesProvider: FavoritesPromptCommand,
        @Inject(forwardRef(() => CreatePromptCommand)) private readonly createProvider: CreatePromptCommand,
        @Inject(forwardRef(() => UpdatePromptCommand)) private readonly updateProvider: UpdatePromptCommand,
        @Inject(forwardRef(() => DeletePromptCommand)) private readonly deleteProvider: DeletePromptCommand,
        @Inject(forwardRef(() => ReadPromptCommand)) private readonly readProvider: ReadPromptCommand,
        @Inject(forwardRef(() => RefreshPromptMetadataCommand))
        private readonly refreshProvider: RefreshPromptMetadataCommand
    ) {}

    public async startPromptInteractionWorkflow(command: CommandInterface): Promise<void> {
        while (true) {
            try {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader('Prompts Library', '📚');
                const choices = this.generateMenuChoices();
                const action = await command.selectMenu<PromptAction>(
                    'Use ↑↓ keys to navigate, Enter to select:',
                    choices,
                    { menuType: 'prompt' }
                );

                if (action === 'back') return;

                await this.executeSelectedAction(action, command, { json: false, isInteractive: true });
            } catch (error) {
                this.errorService.handleCommandError(error, 'prompt interaction workflow');
                await command.pressKeyToContinue();
            }
        }
    }

    private generateMenuChoices(): Array<MenuItem<PromptAction>> {
        return [
            {
                name: this.uiFacade.formatMenuItem('📋 BROWSE PROMPTS', 'separator', 'primary', true).name,
                value: 'separator',
                disabled: true,
                type: 'separator'
            },
            { name: 'View all prompts', value: 'all', type: 'item' },
            { name: 'Browse by category', value: 'category', type: 'item' },
            { name: 'View by ID', value: 'id', type: 'item' },
            { name: 'Search by keyword', value: 'search', type: 'item' },
            { name: '─'.repeat(50), value: 'separator', disabled: true, type: 'separator' },
            {
                name: this.uiFacade.formatMenuItem('📌 MY COLLECTIONS', 'separator', 'primary', true).name,
                value: 'separator',
                disabled: true,
                type: 'separator'
            },
            { name: 'Recent prompts', value: 'recent', type: 'item' },
            { name: 'Favorite prompts', value: 'favorites', type: 'item' },
            { name: '─'.repeat(50), value: 'separator', disabled: true, type: 'separator' },
            {
                name: this.uiFacade.formatMenuItem('🔧 MANAGE PROMPTS', 'separator', 'primary', true).name,
                value: 'separator',
                disabled: true,
                type: 'separator'
            },
            {
                name: this.uiFacade.formatMenuItem('Create new prompt', 'create', 'success').name,
                value: 'create',
                type: 'item'
            },
            {
                name: this.uiFacade.formatMenuItem('Edit existing prompt', 'update', 'warning').name,
                value: 'update',
                type: 'item'
            },
            { name: 'View prompt details by ID', value: 'read', type: 'item' },
            {
                name: this.uiFacade.formatMenuItem('Refresh prompt metadata', 'refresh', 'info').name,
                value: 'refresh',
                type: 'item'
            },
            {
                name: this.uiFacade.formatMenuItem('Delete prompt', 'delete', 'danger').name,
                value: 'delete',
                type: 'item'
            }
        ];
    }

    private async executeSelectedAction(
        action: PromptAction,
        command: CommandInterface,
        options: { json?: boolean; isInteractive?: boolean } = {}
    ): Promise<void> {
        this.uiFacade.clearConsole();
        const runOptions = { ...options, nonInteractive: !options.isInteractive };

        try {
            switch (action) {
                case 'all':
                    await this.listProvider.run([], { ...runOptions, all: true });
                    break;
                case 'category':
                    await this.listProvider.run([], { ...runOptions, category: true });
                    break;
                case 'id':
                    await this.listProvider.run([], { ...runOptions, id: true });
                    break;
                case 'search':
                    await this.searchProvider.run([], runOptions);
                    break;
                case 'recent':
                    await this.recentProvider.run([], runOptions);
                    break;
                case 'favorites':
                    await this.favoritesProvider.run([], runOptions);
                    break;
                case 'create':
                    await this.createProvider.run([], { ...runOptions, analyze: true });
                    break;
                case 'update':
                    await this.updateProvider.run([], { ...runOptions, analyze: true });
                    break;
                case 'delete':
                    await this.deleteProvider.run([], runOptions);
                    break;
                case 'read':
                    await this.readProvider.run([], runOptions);
                    break;
                case 'refresh':
                    await this.refreshProvider.run([], runOptions);
                    break;
                case 'separator':
                    return;
                default:
                    this.loggerService.warn(`Unhandled prompt menu action: ${action}`);
                    break;
            }

            //  if (['all', 'category', 'id', 'search', 'recent', 'favorites', 'read'].includes(action) && options.isInteractive) {
            //      await command.pressKeyToContinue();
            //  }
        } catch (subCommandError) {
            this.errorService.handleCommandError(subCommandError, `running prompt action: ${action}`);
            await command.pressKeyToContinue();
        }
    }
}
