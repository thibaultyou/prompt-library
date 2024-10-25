import { formatTitleCase, formatSnakeCase } from '../string-formatter';

describe('StringFormatterUtils', () => {
    describe('formatTitleCase', () => {
        it('should format string to title case', () => {
            expect(formatTitleCase('hello_world')).toBe('Hello World');
            expect(formatTitleCase('test-case')).toBe('Test Case');
        });
    });

    describe('formatSnakeCase', () => {
        it('should format string to snake case', () => {
            expect(formatSnakeCase('Hello World')).toBe('hello_world');
            expect(formatSnakeCase('TestCase')).toBe('test_case');
            expect(formatSnakeCase('{TEST_VAR}')).toBe('test_var');
        });

        it('should handle special characters', () => {
            expect(formatSnakeCase('Hello {World}')).toBe('hello_world');
            expect(formatSnakeCase('TEST_VAR')).toBe('test_var');
        });
    });
});
