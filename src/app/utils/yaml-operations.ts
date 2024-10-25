import * as yaml from 'js-yaml';

import { PromptMetadata, PromptVariable } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { appConfig } from '../config/app-config';

export function parseYamlContent(yamlContent: string): PromptMetadata {
    try {
        logger.debug('Preparing content for YAML parsing');
        yamlContent = yamlContent.replace(/^\s*<[^>]+>\s*([\s\S]*?)\s*<\/[^>]+>\s*$/, '$1');
        logger.debug('Parsing YAML content');
        const parsedContent = yaml.load(yamlContent) as PromptMetadata;
        logger.debug('YAML content parsed successfully');
        return parsedContent;
    } catch (error) {
        logger.error('YAML parsing error:', error);
        throw new Error(`Failed to parse YAML content: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function dumpYamlContent(data: PromptMetadata): string {
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

export function isValidMetadata(obj: unknown): obj is PromptMetadata {
    const metadata = obj as Partial<PromptMetadata>;

    if (typeof metadata !== 'object' || metadata === null) {
        logger.error('Invalid Metadata: not an object');
        return false;
    }

    const requiredStringFields: (keyof PromptMetadata)[] = [
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

    const requiredArrayFields: (keyof PromptMetadata)[] = ['subcategories', 'tags', 'variables'];

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

function isValidVariable(obj: unknown): obj is PromptVariable {
    const variable = obj as Partial<PromptVariable>;
    return (
        typeof variable === 'object' &&
        variable !== null &&
        typeof variable.name === 'string' &&
        typeof variable.role === 'string'
    );
}

export function parseAndValidateYamlContent(yamlContent: string): PromptMetadata {
    const parsedContent = parseYamlContent(yamlContent);

    if (!isValidMetadata(parsedContent)) {
        logger.error('Invalid Metadata structure');
        throw new Error('Parsed YAML content does not conform to Metadata structure');
    }
    return parsedContent;
}

export function sanitizeYamlContent(content: string): string {
    try {
        logger.debug('Sanitizing YAML content');

        if (content.includes('content_hash:')) {
            return content.trim() + '\n';
        }

        let parsedContent;

        try {
            parsedContent = JSON.parse(content);
        } catch {
            try {
                parsedContent = yaml.load(content);
            } catch {
                return content.trim() + '\n';
            }
        }

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

export function needsSanitization(content: string): boolean {
    try {
        const originalParsed = yaml.load(content);
        const sanitized = sanitizeYamlContent(content);
        const sanitizedParsed = yaml.load(sanitized);
        return JSON.stringify(originalParsed) !== JSON.stringify(sanitizedParsed);
    } catch (error) {
        logger.error('Error checking YAML sanitization:', error);
        return true;
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
