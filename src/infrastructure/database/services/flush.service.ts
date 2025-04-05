import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { DatabaseService } from './database.service';
import { FLUSH_UI } from '../../../shared/constants';
import { ApiResult, CommandInterface, Result } from '../../../shared/types';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class FlushCommandService {
    constructor(
        private readonly dbService: DatabaseService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    public async confirmFlush(command: CommandInterface): Promise<ApiResult<boolean>> {
        try {
            const confirm = await command.confirmAction(FLUSH_UI.INFO.CONFIRM_FLUSH);
            return Result.success(confirm);
        } catch (error) {
            this.loggerService.error(FLUSH_UI.ERRORS.CONFIRM_FLUSH_FAILED, error);
            return Result.failure(FLUSH_UI.ERRORS.CONFIRM_FLUSH_FAILED);
        }
    }

    public async performFlush(): Promise<ApiResult<void>> {
        try {
            const result = await this.dbService.flushData();

            if (!result.success) {
                return Result.failure(result.error || FLUSH_UI.ERRORS.FLUSH_OPERATION_FAILED);
            }
            return Result.success(undefined);
        } catch (error) {
            this.loggerService.error(FLUSH_UI.ERRORS.FLUSH_OPERATION_FAILED, error);
            return Result.failure(FLUSH_UI.ERRORS.FLUSH_OPERATION_FAILED);
        }
    }
}
