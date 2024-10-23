import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { flushData } from '../utils/database';

class FlushCommand extends BaseCommand {
    constructor() {
        super('flush', 'Flush and reset all data (preserves config)');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        try {
            const confirm = await this.confirmAction(
                chalk.yellow('Are you sure you want to flush all data? This action cannot be undone.')
            );

            if (confirm) {
                await this.performFlush();
            } else {
                console.log(chalk.yellow('Flush operation cancelled.'));
            }
        } catch (error) {
            this.handleError(error, 'flush command');
        } finally {
            await this.pressKeyToContinue();
        }
    }

    private async performFlush(): Promise<void> {
        try {
            await flushData();
            console.log(chalk.green('Data flushed successfully. The CLI will now exit.'));
            process.exit(0);
        } catch (error) {
            this.handleError(error, 'flushing data');
        }
    }
}

export default new FlushCommand();
