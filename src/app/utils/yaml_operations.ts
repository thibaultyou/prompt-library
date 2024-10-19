import * as yaml from 'js-yaml';

import { Metadata } from '../../shared/types';
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
        throw new Error(`Failed to parse YAML content: ${(error as Error).message}`);
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
        throw new Error(`Failed to dump Metadata to YAML: ${(error as Error).message}`);
    }
}

/**
 * Validates that a parsed YAML object conforms to the Metadata interface.
 * @param {unknown} obj - The object to validate.
 * @returns {obj is Metadata} True if the object is valid Metadata, false otherwise.
 */
export function isValidMetadata(obj: unknown): obj is Metadata {
    const metadata = obj as Partial<Metadata>;
    return (
        typeof metadata === 'object' &&
        metadata !== null &&
        typeof metadata.title === 'string' &&
        typeof metadata.primary_category === 'string' &&
        Array.isArray(metadata.subcategories) &&
        typeof metadata.directory === 'string' &&
        Array.isArray(metadata.tags) &&
        typeof metadata.one_line_description === 'string' &&
        typeof metadata.description === 'string' &&
        Array.isArray(metadata.variables) &&
        metadata.variables.every(
            (v) => typeof v === 'object' && v !== null && typeof v.name === 'string' && typeof v.role === 'string'
        )
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
        const parsedContent = yaml.load(content);
        const sanitizedContent = yaml.dump(parsedContent, {
            indent: appConfig.YAML_INDENT,
            lineWidth: appConfig.YAML_LINE_WIDTH,
            noRefs: true,
            sortKeys: true
        });
        return sanitizedContent.trim() + '\n';
    } catch (error) {
        logger.error('YAML sanitization error:', error);
        throw new Error(`Failed to sanitize YAML content: ${(error as Error).message}`);
    }
}
