import { select } from '@inquirer/prompts';
import { jest } from '@jest/globals';

import { parseCommand, setupConsoleCapture } from './command-test-utils';
import { flushData } from '../../utils/database';
import flushCommand from '../flush-command';

jest.mock('@inquirer/prompts');
jest.mock('../../utils/database');

const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
describe('FlushCommand', () => {
    let consoleCapture: { getOutput: () => string[]; restore: () => void };
    const mockSelect = select as jest.MockedFunction<typeof select>;
    const mockFlushData = flushData as jest.MockedFunction<typeof flushData>;
    beforeEach(() => {
        consoleCapture = setupConsoleCapture();
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleCapture.restore();
    });

    afterAll(() => {
        mockExit.mockRestore();
    });

    it('should have correct command structure', async () => {
        expect(flushCommand.name()).toBe('flush');
        expect(flushCommand.description()).toBe('Flush and reset all data (preserves config)');
    });

    it('should cancel flush operation when user chooses no', async () => {
        mockSelect.mockResolvedValueOnce('no');

        await parseCommand(flushCommand);

        expect(mockFlushData).not.toHaveBeenCalled();

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('Flush operation cancelled'))).toBe(true);
    });

    it('should perform flush when user confirms', async () => {
        mockSelect.mockResolvedValueOnce('yes');
        mockFlushData.mockResolvedValueOnce();

        await parseCommand(flushCommand);

        expect(mockFlushData).toHaveBeenCalled();

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('Data flushed successfully'))).toBe(true);

        expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle errors during flush operation', async () => {
        mockSelect.mockResolvedValueOnce('yes');
        mockFlushData.mockRejectedValueOnce(new Error('Database error'));

        await parseCommand(flushCommand);

        const output = consoleCapture.getOutput();
        expect(output.some((line) => line.includes('[ERROR]'))).toBe(true);
    });
});
