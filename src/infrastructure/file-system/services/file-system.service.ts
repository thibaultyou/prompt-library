import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { cliConfig } from '../../../shared/config';
import { ApiResult, Result } from '../../../shared/types';
import { LoggerService } from '../../logger/services/logger.service';
import * as fsUtils from '../utils/file-system.utils';

@Injectable({ scope: Scope.DEFAULT })
export class FileSystemService {
    constructor(@Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService) {}

    public async hasPrompts(): Promise<ApiResult<boolean>> {
        try {
            await fsUtils.createDirectory(cliConfig.PROMPTS_DIR);
            const promptDirs = await fsUtils.readDirectory(cliConfig.PROMPTS_DIR);
            return Result.success(promptDirs.length > 0);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error checking prompts directory: ${message}`);
            return Result.failure(`Error checking prompts directory: ${message}`);
        }
    }

    public async hasFragments(): Promise<ApiResult<boolean>> {
        try {
            await fsUtils.createDirectory(cliConfig.FRAGMENTS_DIR);
            const fragmentDirs = await fsUtils.readDirectory(cliConfig.FRAGMENTS_DIR);
            return Result.success(fragmentDirs.length > 0);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error checking fragments directory: ${message}`);
            return Result.failure(`Error checking fragments directory: ${message}`);
        }
    }

    public async ensureDirectory(dirPath: string): Promise<ApiResult<void>> {
        try {
            await fsUtils.createDirectory(dirPath);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error ensuring directory ${dirPath}: ${message}`);
            return Result.failure(`Error ensuring directory exists (${dirPath}): ${message}`);
        }
    }

    public async readDirectory(dirPath: string): Promise<ApiResult<string[]>> {
        try {
            const entries = await fsUtils.readDirectory(dirPath);
            return Result.success(entries);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error reading directory ${dirPath}: ${message}`);
            return Result.failure(`Error reading directory (${dirPath}): ${message}`);
        }
    }

    public async fileExists(filePath: string): Promise<ApiResult<boolean>> {
        try {
            const exists = await fsUtils.fileExists(filePath);
            return Result.success(exists);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error checking file existence ${filePath}: ${message}`);
            return Result.failure(`Error checking if file exists (${filePath}): ${message}`);
        }
    }

    public async readFileContent(filePath: string): Promise<ApiResult<string>> {
        try {
            const content = await fsUtils.readFileContent(filePath);
            return Result.success(content);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Result.failure(`Failed to read file content (${filePath}): ${message}`);
        }
    }

    public async writeFileContent(filePath: string, content: string): Promise<ApiResult<void>> {
        try {
            await fsUtils.writeFileContent(filePath, content);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Result.failure(`Failed to write file content (${filePath}): ${message}`);
        }
    }

    public async isDirectory(itemPath: string): Promise<ApiResult<boolean>> {
        try {
            const isDir = await fsUtils.isDirectory(itemPath);
            return Result.success(isDir);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error checking if path is directory ${itemPath}: ${message}`);
            return Result.failure(`Error checking directory status (${itemPath}): ${message}`);
        }
    }

    public async isFile(itemPath: string): Promise<ApiResult<boolean>> {
        try {
            const isF = await fsUtils.isFile(itemPath);
            return Result.success(isF);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error checking if path is file ${itemPath}: ${message}`);
            return Result.failure(`Error checking file status (${itemPath}): ${message}`);
        }
    }

    public async removeDirectory(dirPath: string): Promise<ApiResult<void>> {
        try {
            await fsUtils.removeDirectory(dirPath);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Result.failure(`Failed to remove directory (${dirPath}): ${message}`);
        }
    }

    public async emptyDirectory(dirPath: string): Promise<ApiResult<void>> {
        try {
            await fsUtils.emptyDirectory(dirPath);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Result.failure(`Failed to empty directory (${dirPath}): ${message}`);
        }
    }
}
