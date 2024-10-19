import chalk from 'chalk';

import { BaseCommand } from './base.command';
import { flushData } from '../utils/database.util';

class FlushCommand extends BaseCommand {
    constructor() {
        super('flush', 'Flush and reset all data (preserves config)');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        const confirm = await this.confirmAction(
            'Are you sure you want to flush all data? This action cannot be undone.'
        );

        if (confirm) {
            try {
                await flushData();
                console.log(chalk.green('Data flushed successfully. The CLI will now exit.'));
                process.exit(0);
            } catch (error) {
                console.error(chalk.red('Error flushing data:'), error);
                await this.pressKeyToContinue();
            }
        } else {
            console.log(chalk.yellow('Flush operation cancelled.'));
        }
    }
}

export default new FlushCommand();
