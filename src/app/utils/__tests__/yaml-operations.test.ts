import * as yaml from 'js-yaml';

import { PromptMetadata } from '../../../shared/types';
import logger from '../../../shared/utils/logger';
import { appConfig } from '../../config/app-config';
import {
    parseYamlContent,
    dumpYamlContent,
    isValidMetadata,
    parseAndValidateYamlContent,
    sanitizeYamlContent,
    needsSanitization
} from '../yaml-operations';

jest.mock('../../../shared/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));
jest.mock('js-yaml', () => {
    const originalModule = jest.requireActual('js-yaml');
    return {
        ...originalModule,
        dump: jest.fn(originalModule.dump)
    };
});

describe('YAMLOperationsUtils', () => {
    const mockValidMetadata: PromptMetadata = {
        title: 'Test Title',
        primary_category: 'Test Category',
        subcategories: ['sub1', 'sub2'],
        directory: 'test-dir',
        tags: ['tag1', 'tag2'],
        one_line_description: 'Test description',
        description: 'Detailed description',
        variables: [
            {
                name: 'var1',
                role: 'system',
                optional_for_user: false
            }
        ]
    };
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('parseYamlContent', () => {
        it('should parse valid YAML content', () => {
            const yamlString = yaml.dump(mockValidMetadata);
            const result = parseYamlContent(yamlString);
            expect(result).toEqual(mockValidMetadata);
        });

        it('should handle XML-like wrapped content', () => {
            const wrappedContent = `<yaml>\n${yaml.dump(mockValidMetadata)}</yaml>`;
            const result = parseYamlContent(wrappedContent);
            expect(result).toEqual(mockValidMetadata);
        });

        it('should throw error for invalid YAML', () => {
            const invalidYaml = '{\n  invalid: yaml: content:';
            expect(() => parseYamlContent(invalidYaml)).toThrow();
        });
    });

    describe('dumpYamlContent', () => {
        it('should dump metadata to YAML format', () => {
            const result = dumpYamlContent(mockValidMetadata);
            const parsed = yaml.load(result) as PromptMetadata;
            expect(parsed).toEqual(mockValidMetadata);
        });

        it('should use configured indent and line width', () => {
            const result = dumpYamlContent(mockValidMetadata);
            const lines = result.split('\n');
            const indentMatch = lines.some((line) => line.startsWith(' '.repeat(appConfig.YAML_INDENT)));
            expect(indentMatch).toBeTruthy();
        });

        it('should throw error for invalid input', () => {
            const invalidInput = {
                circular: {}
            };
            invalidInput.circular = invalidInput;
            expect(() => dumpYamlContent(invalidInput as any)).toThrow();
        });
    });

    describe('isValidMetadata', () => {
        it('should validate correct metadata', () => {
            expect(isValidMetadata(mockValidMetadata)).toBeTruthy();
        });

        it('should reject null input', () => {
            expect(isValidMetadata(null)).toBeFalsy();
        });

        it('should reject missing required fields', () => {
            const invalidMetadata = { ...mockValidMetadata };
            delete (invalidMetadata as any).title;
            expect(isValidMetadata(invalidMetadata)).toBeFalsy();
        });

        it('should reject invalid variable structure', () => {
            const invalidMetadata = {
                ...mockValidMetadata,
                variables: [{ invalid: 'structure' }]
            };
            expect(isValidMetadata(invalidMetadata)).toBeFalsy();
        });

        it('should reject variables that are not objects', () => {
            const invalidMetadata = {
                ...mockValidMetadata,
                variables: [null]
            };
            expect(isValidMetadata(invalidMetadata)).toBeFalsy();
        });
    });

    describe('parseAndValidateYamlContent', () => {
        it('should parse and validate correct YAML', () => {
            const yamlString = yaml.dump(mockValidMetadata);
            const result = parseAndValidateYamlContent(yamlString);
            expect(result).toEqual(mockValidMetadata);
        });

        it('should throw error for invalid metadata structure', () => {
            const invalidYaml = yaml.dump({ invalid: 'structure' });
            expect(() => parseAndValidateYamlContent(invalidYaml)).toThrow();
        });
    });

    describe('sanitizeYamlContent', () => {
        it('should handle simple key-value content', () => {
            const content = 'content_hash: abc123\n';
            const result = sanitizeYamlContent(content);
            expect(result).toBe(content);
        });

        it('should sanitize complex YAML content', () => {
            const messyYaml = yaml.dump(mockValidMetadata).replace(/\n/g, '\n\n');
            const result = sanitizeYamlContent(messyYaml);
            expect(result).toBe(
                yaml
                    .dump(mockValidMetadata, {
                        indent: appConfig.YAML_INDENT,
                        lineWidth: appConfig.YAML_LINE_WIDTH,
                        noRefs: true,
                        sortKeys: true
                    })
                    .trim() + '\n'
            );
        });

        it('should handle JSON content', () => {
            const jsonContent = JSON.stringify(mockValidMetadata);
            const result = sanitizeYamlContent(jsonContent);
            expect(() => yaml.load(result)).not.toThrow();
        });

        it('should return content as-is if both JSON and YAML parsing fail', () => {
            const invalidContent = 'not valid yaml or json';
            const result = sanitizeYamlContent(invalidContent);
            expect(result).toBe(invalidContent.trim() + '\n');
        });

        it('should throw error when dumping fails in sanitizeYamlContent', () => {
            const content = 'valid: yaml';
            (yaml.dump as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Dumping failed');
            });

            expect(() => sanitizeYamlContent(content)).toThrow('Dumping failed');
        });
    });

    describe('needsSanitization', () => {
        it('should detect content needing sanitization', () => {
            const messyYaml = yaml.dump(mockValidMetadata).replace(/\n/g, '\n\n');
            expect(needsSanitization(messyYaml)).toBeTruthy();
        });

        it('should pass already sanitized content', () => {
            const cleanYaml = yaml.dump(mockValidMetadata, {
                indent: appConfig.YAML_INDENT,
                lineWidth: appConfig.YAML_LINE_WIDTH,
                noRefs: true,
                sortKeys: true
            });
            expect(needsSanitization(cleanYaml)).toBeFalsy();
        });

        it('should return true for invalid YAML content needing sanitization', () => {
            const invalidYaml = 'invalid: yaml: content';
            const result = needsSanitization(invalidYaml);
            expect(result).toBeTruthy();
            expect(logger.error).toHaveBeenCalledWith('Error checking YAML sanitization:', expect.any(Error));
        });
    });
});
