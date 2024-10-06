import * as yaml from 'js-yaml';
import { Metadata } from '../types/metadata';
import logger from './logger';
import config from '../config';

type PartialMetadata = {
    title?: unknown;
    primary_category?: unknown;
    subcategories?: unknown;
    directory?: unknown;
    tags?: unknown;
    one_line_description?: unknown;
    description?: unknown;
    variables?: unknown;
};

/**
 * Parses YAML content into a Metadata object.
 *
 * @param yamlContent - The YAML content to parse.
 * @returns The parsed Metadata object.
 * @throws Error if parsing fails.
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
 *
 * @param data - The Metadata object to dump.
 * @returns The YAML string representation of the Metadata.
 * @throws Error if dumping fails.
 */
export function dumpYamlContent(data: Metadata): string {
    try {
        logger.debug('Dumping Metadata to YAML');
        const yamlString = yaml.dump(data, {
            indent: config.YAML_INDENT,
            lineWidth: config.YAML_LINE_WIDTH,
            noRefs: true,
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
 *
 * @param obj - The object to validate.
 * @returns True if the object is valid Metadata, false otherwise.
 */
export function isValidMetadata(obj: PartialMetadata): obj is Metadata {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.title === 'string' &&
        typeof obj.primary_category === 'string' &&
        Array.isArray(obj.subcategories) &&
        typeof obj.directory === 'string' &&
        Array.isArray(obj.tags) &&
        typeof obj.one_line_description === 'string' &&
        typeof obj.description === 'string' &&
        Array.isArray(obj.variables)
    );
}

/**
 * Parses YAML content and validates it as Metadata.
 *
 * @param yamlContent - The YAML content to parse and validate.
 * @returns The validated Metadata object.
 * @throws Error if parsing fails or the content is not valid Metadata.
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
 * @param content - The YAML content to sanitize.
 * @returns Sanitized YAML content.
 */
export function sanitizeYamlContent(content: string): string {
    const lines = content.split('\n');
    const sanitizedLines = lines.map((line) => {
        const trimmedLine = line.trimStart();
        if (trimmedLine.includes(':') && !trimmedLine.endsWith(':')) {
            const [key, ...values] = trimmedLine.split(':');
            return `${key}:${values.join(':').trimStart()}`;
        }
        return trimmedLine;
    });
    return sanitizedLines.join('\n').trim() + '\n';
}
