import { Injectable } from '@nestjs/common';
import { CommandRunner } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { INFO_MESSAGES } from '../../../shared/constants';
import { CommandInterface, ApiResult, MenuItem, MenuOptions, ConfirmOptions, Result } from '../../../shared/types';

@Injectable()
export abstract class BaseCommandRunner extends CommandRunner implements CommandInterface {
    constructor(
        protected readonly uiFacade: UiFacade,
        protected readonly errorService: ErrorService,
        protected readonly repositoryService: RepositoryService
    ) {
        super();
    }

    async selectMenu<T>(message: string, choices: MenuItem<T>[], options?: MenuOptions<T>): Promise<T> {
        return this.uiFacade.selectMenu(message, choices, options);
    }

    async pressKeyToContinue(message?: string): Promise<void> {
        if (this.isRunningInCIEnvironment()) return;
        return this.uiFacade.pressKeyToContinue(message || INFO_MESSAGES.PRESS_KEY_TO_CONTINUE);
    }

    async confirmAction(message: string, options?: ConfirmOptions): Promise<boolean> {
        if (options?.nonInteractive || this.isRunningInCIEnvironment()) {
            return options?.default ?? false;
        }
        return this.uiFacade.confirm(message, options?.default);
    }

    async getMultilineInput(
        message: string,
        initialValue?: string,
        options?: { instructionMessage?: string }
    ): Promise<string> {
        return this.uiFacade.getMultilineInput(message, initialValue, options);
    }

    async getInput(
        message: string,
        options?: { default?: string; nonInteractive?: boolean; allowCancel?: boolean }
    ): Promise<string | null> {
        if (options?.nonInteractive || this.isRunningInCIEnvironment()) {
            return options?.default ?? null;
        }
        return this.uiFacade.getInput(message, options?.default, options?.allowCancel);
    }

    handleError(error: unknown, context: string): void {
        this.errorService.handleCommandError(error, context);
    }

    handleApiResultSync<T>(result: ApiResult<T>, successMessage?: string): T | null {
        if (!result.success) {
            this.errorService.logError(result.error || 'Operation failed', 'ApiResultSync');
            return null;
        }

        if (successMessage) {
            this.uiFacade.print(this.uiFacade.textFormatter.successMessage(successMessage));
        }
        return result.data === undefined ? null : result.data;
    }

    async handleApiResult<T>(result: ApiResult<T>, message: string): Promise<T | null> {
        return this.handleApiResultSync(result, result.success ? message : undefined);
    }

    async isLibraryRepositorySetup(): Promise<boolean> {
        const result = await this.repositoryService.isLibraryRepositorySetup();
        return result.success && result.data === true;
    }

    isRunningInCIEnvironment(): boolean {
        return (
            process.env.CI === 'true' ||
            process.env.GITHUB_ACTIONS === 'true' ||
            process.env.GITLAB_CI === 'true' ||
            process.env.TRAVIS === 'true' ||
            process.env.CIRCLECI === 'true' ||
            process.env.JENKINS_URL !== undefined ||
            process.env.DRONE === 'true' ||
            process.env.CLI_ENV === 'ci'
        );
    }

    protected isJsonOutput(options: { json?: boolean }): boolean {
        return !!options?.json;
    }

    protected writeJsonResponse<T>(data: { success: boolean; error?: string; data?: T }): void {
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    }

    abstract run(passedParams: string[], options?: Record<string, any>): Promise<void>;

    protected async executeWithErrorHandling<T>(context: string, fn: () => Promise<T>): Promise<ApiResult<T>> {
        try {
            const result = await fn();
            return Result.success(result);
        } catch (error) {
            this.handleError(error, context);

            if (error instanceof Error) {
                return Result.failure(error.message);
            } else {
                return Result.failure('Unknown error during execution');
            }
        }
    }
}
