import { Command } from 'commander';

import { BaseCommand } from './base.command';
import ConfigCommand from './config.command';
import FlushCommand from './flush.command';
import SyncCommand from './sync.command';

type SettingsAction = 'config' | 'sync' | 'flush' | 'back';

class SettingsCommand extends BaseCommand {
    private configCommand: Command;
    private syncCommand: Command;
    private flushCommand: Command;

    constructor() {
        super('settings', 'Manage CLI configuration');
        this.action(this.execute.bind(this));

        this.configCommand = ConfigCommand;
        this.syncCommand = SyncCommand;
        this.flushCommand = FlushCommand;
    }

    async execute(): Promise<void> {
        while (true) {
            const action = await this.showMenu<SettingsAction>('Settings Menu:', [
                { name: 'Configure CLI', value: 'config' },
                { name: 'Sync with remote repository', value: 'sync' },
                { name: 'Flush and reset data', value: 'flush' }
            ]);
            switch (action) {
                case 'config':
                    await this.configCommand.parseAsync([], { from: 'user' });
                    break;
                case 'sync':
                    await this.syncCommand.parseAsync([], { from: 'user' });
                    break;
                case 'flush':
                    await this.flushCommand.parseAsync([], { from: 'user' });
                    break;
                case 'back':
                    return;
            }
        }
    }
}

export default new SettingsCommand();
