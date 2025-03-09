import crypto from 'crypto';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ApiResult, Result } from '../../../shared/types';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class HashService {
    constructor(@Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService) {}

    async generateContentHash(content: string): Promise<ApiResult<string>> {
        try {
            if (typeof content !== 'string') {
                return Result.failure('Content must be a string to generate hash.');
            }

            const hash = crypto.createHash('md5').update(content).digest('hex');
            this.loggerService.debug('Generated MD5 content hash.');
            return Result.success(hash);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error generating content hash: ${message}`);
            return Result.failure(`Failed to generate content hash: ${message}`);
        }
    }
}
