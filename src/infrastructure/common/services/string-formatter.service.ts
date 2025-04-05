import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { FRAGMENT_PREFIX, ENV_PREFIX } from '../../../shared/constants';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class StringFormatterService {
    constructor(@Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService) {}
    formatTitleCase(text?: string): string {
        if (!text) return 'Unknown';
        return text
            .split(/[_-]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    formatSnakeCase(text: string): string {
        if (!text) return '';

        const cleanText = text.trim().replace(/^_+/, '');
        return cleanText
            .replace(/[{}]/g, '')
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toLowerCase()
            .replace(/[-\s]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_/, '')
            .replace(/_$/g, '');
    }

    normalizeVariableName(varName: string, forStorage: boolean = false): string {
        if (!varName) return '';

        const normalized = this.formatSnakeCase(varName);
        return forStorage ? normalized.toUpperCase() : normalized;
    }

    formatRelativeTime(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);

        if (diffSec < 60) return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;

        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;

        if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    }

    formatMessage(template: string, ...args: any[]): string {
        return template.replace(/{(\d+)}/g, (match, index) => {
            const argIndex = parseInt(index, 10);
            return args[argIndex] !== undefined ? String(args[argIndex]) : match;
        });
    }

    updatePromptWithVariables(content: string, variables: Record<string, string>): string {
        if (content === null || content === undefined) {
            throw new Error('Content cannot be null or undefined for variable substitution.');
        }

        this.loggerService.debug(`Substituting variables. Provided: ${Object.keys(variables).join(', ')}`);
        let updatedContent = content;

        for (const [key, value] of Object.entries(variables)) {
            if (typeof value !== 'string') {
                throw new Error(`Variable value for key "${key}" must be a string, received type ${typeof value}.`);
            }

            if (value.startsWith('<') && value.endsWith('>')) {
                if (value.includes(FRAGMENT_PREFIX.trim()) || value.includes('Fragment not found')) {
                    this.loggerService.warn(`Potential unresolved fragment ref for ${key}: ${value}`);
                } else if (value.includes(ENV_PREFIX.trim()) || value.includes('Env var not found')) {
                    this.loggerService.warn(`Potential unresolved env var ref for ${key}: ${value}`);
                }
            }

            const normalizedKey = key.replace(/[{}]/g, '');
            const regex = new RegExp(`{{\\s*${normalizedKey}\\s*}}`, 'gi');
            const occurrences = (updatedContent.match(regex) || []).length;

            if (occurrences > 0) {
                this.loggerService.debug(`Replacing ${occurrences}x {{${normalizedKey}}} (value len ${value.length}).`);
            }

            updatedContent = updatedContent.replace(regex, value);
        }
        const remainingVars = updatedContent.match(/\{\{([A-Z0-9_]+)\}\}/gi);

        if (remainingVars) {
            this.loggerService.warn(`Unsubstituted variables remaining: ${[...new Set(remainingVars)].join(', ')}`);
        }
        return updatedContent;
    }
}
