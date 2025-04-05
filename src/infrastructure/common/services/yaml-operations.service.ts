import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import * as yaml from 'js-yaml';

import { appConfig } from '../../../shared/config';
import { PromptMetadata, ApiResult, Result } from '../../../shared/types';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class YamlOperationsService {
    constructor(@Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService) {}

    parseYamlContent(yamlContent: string): ApiResult<PromptMetadata> {
        try {
            this.loggerService.debug('Preparing content for YAML parsing...');
            const cleanedContent = yamlContent
                .replace(/^\s*<[^>]+>\s*/, '')
                .replace(/\s*<\/[^>]+>\s*$/, '')
                .trim();
            this.loggerService.debug('Parsing YAML content...');
            const parsedContent = yaml.load(cleanedContent);
            this.loggerService.debug('YAML content parsed successfully.');

            if (typeof parsedContent !== 'object' || parsedContent === null) {
                throw new Error('Parsed YAML is not an object.');
            }

            if (!this.isValidMetadataStructure(parsedContent)) {
                this.loggerService.warn('Parsed YAML does not fully match PromptMetadata structure.');
            }
            return Result.success(parsedContent as PromptMetadata);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`YAML parsing error: ${message}`);
            return Result.failure(`Failed to parse YAML content: ${message}`);
        }
    }

    dumpYamlContent(data: Partial<PromptMetadata>): ApiResult<string> {
        try {
            this.loggerService.debug('Dumping metadata object to YAML string...');
            const dataToDump = {
                title: data.title ?? '',
                primary_category: data.primary_category ?? 'uncategorized',
                directory: data.directory ?? '',
                ...data
            };
            const yamlString = yaml.dump(dataToDump, {
                indent: appConfig.YAML_INDENT,
                lineWidth: appConfig.YAML_LINE_WIDTH,
                noRefs: true,
                sortKeys: false,
                quotingType: '"'
            });
            this.loggerService.debug('Metadata dumped to YAML successfully.');
            return Result.success(yamlString.trim() + '\n');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`YAML dumping error: ${message}`);
            return Result.failure(`Failed to dump metadata to YAML: ${message}`);
        }
    }

    private isValidMetadataStructure(obj: unknown): obj is Partial<PromptMetadata> {
        if (typeof obj !== 'object' || obj === null) {
            this.loggerService.warn('Validation failed: Input is not an object.');
            return false;
        }

        const metadata = obj as Partial<PromptMetadata>;
        const hasRequiredKeys = 'title' in metadata && 'primary_category' in metadata && 'directory' in metadata;

        if (!hasRequiredKeys) {
            this.loggerService.warn('Validation failed: Missing key fields (title, primary_category, directory).');
            return false;
        }
        return true;
    }

    parseAndValidateYamlContent(yamlContent: string): ApiResult<PromptMetadata> {
        const parseResult = this.parseYamlContent(yamlContent);

        if (!parseResult.success || !parseResult.data) return parseResult;

        if (!this.isValidMetadataStructure(parseResult.data)) {
            return Result.failure('Parsed YAML does not match expected PromptMetadata structure.');
        }
        return Result.success(parseResult.data);
    }

    sanitizeYamlContent(content: string): ApiResult<string> {
        this.loggerService.debug('Sanitizing YAML content...');

        try {
            const parsedResult = this.parseYamlContent(content);

            if (!parsedResult.success || !parsedResult.data) {
                this.loggerService.warn(`Sanitization failed during parsing: ${parsedResult.error}.`);
                return Result.failure(parsedResult.error || 'Failed to parse YAML for sanitization.');
            }

            const dumpResult = this.dumpYamlContent(parsedResult.data);

            if (!dumpResult.success || dumpResult.data === undefined) {
                this.loggerService.warn(`Sanitization failed during dumping: ${dumpResult.error}.`);
                return Result.failure(dumpResult.error || 'Failed to dump YAML for sanitization.');
            }

            this.loggerService.debug('YAML content sanitized successfully.');
            return Result.success(dumpResult.data);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`YAML sanitization error: ${message}`);
            return Result.failure(`Failed to sanitize YAML content: ${message}`);
        }
    }
}
