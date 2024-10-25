import { readDirectory, isDirectory } from '../../../shared/utils/file-system';
import logger from '../../../shared/utils/logger';
import { listAvailableFragments } from '../fragment-manager';

jest.mock('../../../shared/utils/file-system');
jest.mock('../../../shared/utils/logger');
jest.mock('../../config/app-config', () => ({
    appConfig: {
        FRAGMENTS_DIR: '/mock/fragments/dir'
    }
}));

describe('FragmentManagerUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should list fragments from all categories', async () => {
        const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
        const mockIsDirectory = isDirectory as jest.MockedFunction<typeof isDirectory>;
        mockReadDirectory.mockImplementationOnce(async () => ['category1', 'category2']);

        mockReadDirectory
            .mockImplementationOnce(async () => ['fragment1.js', 'fragment2.js'])
            .mockImplementationOnce(async () => ['fragment3.js']);

        mockIsDirectory.mockImplementation(async () => true);

        const result = await listAvailableFragments();
        const parsed = JSON.parse(result);
        expect(parsed).toEqual({
            category1: ['fragment1', 'fragment2'],
            category2: ['fragment3']
        });

        expect(logger.info).toHaveBeenCalledWith('Listing available fragments');
        expect(logger.info).toHaveBeenCalledWith('Listed fragments from 2 categories');
    });

    it('should skip non-directory entries', async () => {
        const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
        const mockIsDirectory = isDirectory as jest.MockedFunction<typeof isDirectory>;
        mockReadDirectory.mockImplementationOnce(async () => ['category1', 'not-a-dir']);
        mockReadDirectory.mockImplementationOnce(async () => ['fragment1.js']);

        mockIsDirectory.mockImplementationOnce(async () => true).mockImplementationOnce(async () => false);

        const result = await listAvailableFragments();
        const parsed = JSON.parse(result);
        expect(parsed).toEqual({
            category1: ['fragment1']
        });
    });

    it('should handle empty categories', async () => {
        const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
        const mockIsDirectory = isDirectory as jest.MockedFunction<typeof isDirectory>;
        mockReadDirectory.mockImplementationOnce(async () => ['empty-category']);
        mockReadDirectory.mockImplementationOnce(async () => []);
        mockIsDirectory.mockImplementation(async () => true);

        const result = await listAvailableFragments();
        const parsed = JSON.parse(result);
        expect(parsed).toEqual({
            'empty-category': []
        });
    });

    it('should handle errors and log them', async () => {
        const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
        const error = new Error('Test error');
        mockReadDirectory.mockRejectedValue(error);

        await expect(listAvailableFragments()).rejects.toThrow('Test error');
        expect(logger.error).toHaveBeenCalledWith('Error listing available fragments:', error);
    });
});
