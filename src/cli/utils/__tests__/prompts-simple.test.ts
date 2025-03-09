import { getPromptFiles, getPromptMetadata } from '../prompts';

jest.mock('../database', () => ({
    getAsync: jest.fn(),
    allAsync: jest.fn()
}));

describe('PromptUtils - Simple Tests', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('getPromptFiles()', () => {
        it('should return error when prompt is not found', async () => {
            const { getAsync } = jest.requireMock('../database');
            getAsync.mockResolvedValueOnce({ success: false });
            getAsync.mockResolvedValueOnce({ success: false });

            const result = await getPromptFiles('missing');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt not found');
        });

        it('should return error on metadata failure', async () => {
            const { getAsync } = jest.requireMock('../database');
            getAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', content: 'test' }
            });

            getAsync.mockResolvedValueOnce({ success: false });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get prompt metadata');
        });
    });

    describe('getPromptMetadata()', () => {
        it('should handle ID not found', async () => {
            const { getAsync } = jest.requireMock('../database');
            const originalIsNaN = global.isNaN;
            global.isNaN = jest.fn().mockReturnValue(false);

            try {
                getAsync.mockResolvedValueOnce({ success: false });

                const result = await getPromptMetadata('1');
                expect(result.success).toBe(false);
                expect(result.error).toBe('Metadata not found');
            } finally {
                global.isNaN = originalIsNaN;
            }
        });

        it('should handle subcategories failure', async () => {
            const { getAsync, allAsync } = jest.requireMock('../database');
            getAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            allAsync.mockResolvedValueOnce({ success: false });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get subcategories');
        });

        it('should handle variables failure', async () => {
            const { getAsync, allAsync } = jest.requireMock('../database');
            getAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            allAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }]
            });

            allAsync.mockResolvedValueOnce({ success: false });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get variables');
        });

        it('should handle fragments failure', async () => {
            const { getAsync, allAsync } = jest.requireMock('../database');
            getAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            allAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }]
            });

            allAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'var1', role: 'test', optional_for_user: false }]
            });

            allAsync.mockResolvedValueOnce({ success: false });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get fragments');
        });
    });
});
