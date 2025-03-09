import { Command } from 'commander';

export function createMockCommand(): Command {
    const command = new Command();
    command.exitOverride();
    return command;
}

export function setupConsoleCapture(): { getOutput: () => string[]; restore: () => void } {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const output: string[] = [];
    console.log = jest.fn((...args) => {
        output.push(args.join(' '));
    });

    console.error = jest.fn((...args) => {
        output.push('[ERROR] ' + args.join(' '));
    });

    const returnObject = {
        getOutput: (): string[] => output,
        restore: (): void => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
        }
    };
    return returnObject;
}

export async function parseCommand(command: Command, args: string[] = []): Promise<unknown> {
    try {
        const fullArgs = ['node', 'test.js', ...args];
        return await command.parseAsync(fullArgs);
    } catch (error: any) {
        if (error && error.code === 'commander.helpDisplayed') {
            return null;
        }

        throw error;
    }
}
