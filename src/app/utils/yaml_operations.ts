import * as yaml from 'js-yaml';

import { Metadata, Variable } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { appConfig } from '../config/app.config';

/**
 * Parses YAML content into a Metadata object.
 * @param {string} yamlContent - The YAML content to parse.
 * @returns {Metadata} The parsed Metadata object.
 * @throws {Error} If parsing fails.
 */
export function parseYamlContent(yamlContent: string): Metadata {
    try {
        logger.debug('Parsing YAML content');
        const parsedContent = yaml.load(yamlContent) as Metadata;
        logger.debug('YAML content parsed successfully');
        return parsedContent;
    } catch (error) {
        logger.error('YAML parsing error:', error);
        throw new Error(`Failed to parse YAML content: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Dumps a Metadata object into a YAML string.
 * @param {Metadata} data - The Metadata object to dump.
 * @returns {string} The YAML string representation of the Metadata.
 * @throws {Error} If dumping fails.
 */
export function dumpYamlContent(data: Metadata): string {
    try {
        logger.debug('Dumping Metadata to YAML');
        const yamlString = yaml.dump(data, {
            indent: appConfig.YAML_INDENT,
            lineWidth: appConfig.YAML_LINE_WIDTH,
            noRefs: true
        });
        logger.debug('Metadata dumped to YAML successfully');
        return yamlString;
    } catch (error) {
        logger.error('YAML dumping error:', error);
        throw new Error(`Failed to dump Metadata to YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Validates that a parsed YAML object conforms to the Metadata interface.
 * @param {unknown} obj - The object to validate.
 * @returns {obj is Metadata} True if the object is valid Metadata, false otherwise.
 */
export function isValidMetadata(obj: unknown): obj is Metadata {
    const metadata = obj as Partial<Metadata>;

    if (typeof metadata !== 'object' || metadata === null) {
        logger.error('Invalid Metadata: not an object');
        return false;
    }

    const requiredStringFields: (keyof Metadata)[] = [
        'title',
        'primary_category',
        'directory',
        'one_line_description',
        'description'
    ];

    for (const field of requiredStringFields) {
        if (typeof metadata[field] !== 'string') {
            logger.error(`Invalid Metadata: ${field} is not a string`);
            return false;
        }
    }

    const requiredArrayFields: (keyof Metadata)[] = ['subcategories', 'tags', 'variables'];

    for (const field of requiredArrayFields) {
        if (!Array.isArray(metadata[field])) {
            logger.error(`Invalid Metadata: ${field} is not an array`);
            return false;
        }
    }

    if (!Array.isArray(metadata.variables) || !metadata.variables.every(isValidVariable)) {
        logger.error('Invalid Metadata: variables is not an array or contains invalid variables');
        return false;
    }
    return true;
}

/**
 * Validates that an object conforms to the Variable interface.
 * @param {unknown} obj - The object to validate.
 * @returns {obj is Variable} True if the object is a valid Variable, false otherwise.
 */
function isValidVariable(obj: unknown): obj is Variable {
    const variable = obj as Partial<Variable>;
    return (
        typeof variable === 'object' &&
        variable !== null &&
        typeof variable.name === 'string' &&
        typeof variable.role === 'string'
    );
}

/**
 * Parses YAML content and validates it as Metadata.
 * @param {string} yamlContent - The YAML content to parse and validate.
 * @returns {Metadata} The validated Metadata object.
 * @throws {Error} If parsing fails or the content is not valid Metadata.
 */
export function parseAndValidateYamlContent(yamlContent: string): Metadata {
    const parsedContent = parseYamlContent(yamlContent);

    if (!isValidMetadata(parsedContent)) {
        logger.error('Invalid Metadata structure');
        throw new Error('Parsed YAML content does not conform to Metadata structure');
    }
    return parsedContent;
}

/**
 * Sanitizes YAML content by removing extra spaces and ensuring proper formatting.
 * @param {string} content - The YAML content to sanitize.
 * @returns {string} Sanitized YAML content.
 */
export function sanitizeYamlContent(content: string): string {
    try {
        logger.debug('Sanitizing YAML content');
        const parsedContent = yaml.load(content);
        const sanitizedContent = yaml.dump(parsedContent, {
            indent: appConfig.YAML_INDENT,
            lineWidth: appConfig.YAML_LINE_WIDTH,
            noRefs: true,
            sortKeys: true
        });
        logger.debug('YAML content sanitized successfully');
        return sanitizedContent.trim() + '\n';
    } catch (error) {
        logger.error('YAML sanitization error:', error);
        throw new Error(`Failed to sanitize YAML content: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Determines if a YAML content needs sanitization.
 * @param {string} content - The YAML content to check.
 * @returns {boolean} True if the content needs sanitization, false otherwise.
 */
export function needsSanitization(content: string): boolean {
    try {
        const originalParsed = yaml.load(content);
        const sanitized = sanitizeYamlContent(content);
        const sanitizedParsed = yaml.load(sanitized);
        return JSON.stringify(originalParsed) !== JSON.stringify(sanitizedParsed);
    } catch (error) {
        logger.error('Error checking YAML sanitization:', error);
        return true; // If we can't parse it, it probably needs sanitization
    }
}

export default {
    parseYamlContent,
    dumpYamlContent,
    isValidMetadata,
    parseAndValidateYamlContent,
    sanitizeYamlContent,
    needsSanitization
};
