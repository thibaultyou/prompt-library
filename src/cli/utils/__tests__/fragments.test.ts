import path from 'path';

import { jest } from '@jest/globals';

import { Fragment } from '../../../shared/types';
import { readDirectory, readFileContent } from '../../../shared/utils/file-system';
import { cliConfig } from '../../config/cli-config';
import { listFragments, viewFragmentContent } from '../fragments';

jest.mock('../../../shared/utils/file-system');
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

describe('FragmentsUtils', () => {
    const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
    const mockReadFileContent = readFileContent as jest.MockedFunction<typeof readFileContent>;
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listFragments', () => {
        it('should successfully list fragments', async () => {
            mockReadDirectory
                .mockResolvedValueOnce(['category1', 'category2'])
                .mockResolvedValueOnce(['fragment1.md', 'fragment2.md'])
                .mockResolvedValueOnce(['fragment3.md']);

            const expectedFragments: Fragment[] = [
                { category: 'category1', name: 'fragment1', variable: '' },
                { category: 'category1', name: 'fragment2', variable: '' },
                { category: 'category2', name: 'fragment3', variable: '' }
            ];
            const result = await listFragments();
            expect(result.success).toBe(true);
            expect(result.data).toEqual(expectedFragments);
            expect(mockReadDirectory).toHaveBeenCalledWith(cliConfig.FRAGMENTS_DIR);
        });

        it('should handle errors when listing fragments', async () => {
            mockReadDirectory.mockRejectedValueOnce(new Error('Directory read error'));

            const result = await listFragments();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to list fragments');
        });

        it('should ignore non-markdown files', async () => {
            mockReadDirectory
                .mockResolvedValueOnce(['category1'])
                .mockResolvedValueOnce(['fragment1.md', 'fragment2.txt', 'fragment3.md']);

            const expectedFragments: Fragment[] = [
                { category: 'category1', name: 'fragment1', variable: '' },
                { category: 'category1', name: 'fragment3', variable: '' }
            ];
            const result = await listFragments();
            expect(result.success).toBe(true);
            expect(result.data).toEqual(expectedFragments);
        });
    });

    describe('viewFragmentContent', () => {
        it('should successfully read fragment content', async () => {
            const mockContent = '# Fragment Content';
            mockReadFileContent.mockResolvedValueOnce(mockContent);

            const result = await viewFragmentContent('category1', 'fragment1');
            expect(result.success).toBe(true);
            expect(result.data).toBe(mockContent);
            expect(mockReadFileContent).toHaveBeenCalledWith(
                path.join(cliConfig.FRAGMENTS_DIR, 'category1', 'fragment1.md')
            );
        });

        it('should handle errors when reading fragment content', async () => {
            mockReadFileContent.mockRejectedValueOnce(new Error('File read error'));

            const result = await viewFragmentContent('category1', 'fragment1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to view fragment content');
        });
    });
});
