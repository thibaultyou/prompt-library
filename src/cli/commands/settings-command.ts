import { BaseCommand } from './base-command';
import ConfigCommand from './config-command';
import FlushCommand from './flush-command';
import SyncCommand from './sync-command';

type SettingsAction = 'config' | 'sync' | 'flush' | 'back';

class SettingsCommand extends BaseCommand {
    private configCommand: BaseCommand;
    private syncCommand: BaseCommand;
    private flushCommand: BaseCommand;

    constructor() {
        super('settings', 'Manage CLI configuration');
        this.action(this.execute.bind(this));

        this.configCommand = ConfigCommand;
        this.syncCommand = SyncCommand;
        this.flushCommand = FlushCommand;
    }

    async execute(): Promise<void> {
        while (true) {
            try {
                const action = await this.showMenu<SettingsAction>('Settings Menu:', [
                    { name: 'Configure CLI', value: 'config' },
                    { name: 'Sync with remote repository', value: 'sync' },
                    { name: 'Flush and reset data', value: 'flush' }
                ]);
                switch (action) {
                    case 'config':
                        await this.runSubCommand(this.configCommand);
                        break;
                    case 'sync':
                        await this.runSubCommand(this.syncCommand);
                        break;
                    case 'flush':
                        await this.runSubCommand(this.flushCommand);
                        break;
                    case 'back':
                        return;
                }
            } catch (error) {
                this.handleError(error, 'settings menu');
                await this.pressKeyToContinue();
            }
        }
    }
}

export default new SettingsCommand();
