import fs from 'fs';

import { Injectable, Scope, OnModuleInit } from '@nestjs/common';
import chalk from 'chalk';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { CONFIG_FILE, ENV_KEYS, INFO_MESSAGES, PROVIDERS } from '../../shared/constants';
import { ConfigFacade } from '../facades/config.facade';
import { RepositoryFacade } from '../facades/repository.facade';

@Injectable({ scope: Scope.DEFAULT })
export class CliInitializationService implements OnModuleInit {
    constructor(
        private readonly errorService: ErrorService,
        private readonly loggerService: LoggerService,
        private readonly configFacade: ConfigFacade,
        private readonly repositoryFacade: RepositoryFacade
    ) {}

    async onModuleInit(): Promise<void> {
        this.loggerService.debug('>>> Entering CliInitializationService.onModuleInit');

        try {
            this.loggerService.debug('>>> [onModuleInit] Starting prerequisite checks...');
            this.loggerService.debug('>>> [onModuleInit] Calling ensureApiKey...');
            await this.ensureApiKey();
            this.loggerService.debug('>>> [onModuleInit] ensureApiKey finished.');
            this.loggerService.debug('>>> [onModuleInit] Calling repositoryFacade.isLibraryRepositorySetup...');
            const repoSetupResult = await this.repositoryFacade.isLibraryRepositorySetup();
            this.loggerService.debug(
                `>>> [onModuleInit] repositoryFacade.isLibraryRepositorySetup returned: ${JSON.stringify(repoSetupResult)}`
            );
            this.loggerService.debug('>>> [onModuleInit] Evaluating repoSetupResult...');

            if (!repoSetupResult.success || !repoSetupResult.data) {
                this.loggerService.warn('>>> [onModuleInit] Repository setup check FAILED or not set up.');
                this.loggerService.warn(INFO_MESSAGES.REPO_NOT_FOUND);
                this.loggerService.info(INFO_MESSAGES.SETUP_PROMPT);
                this.loggerService.info(chalk.bold(`\n  ${INFO_MESSAGES.SETUP_COMMAND}\n`));
            } else {
                this.loggerService.debug('>>> [onModuleInit] Repository setup check SUCCEEDED.');
            }

            this.loggerService.debug('>>> [onModuleInit] Prerequisite checks logic completed.');
        } catch (error) {
            this.loggerService.error(
                `>>> [onModuleInit] Error during prerequisite checks: ${error instanceof Error ? error.message : String(error)}`
            );
            this.errorService.handleError(error, 'CLI Initialization Checks');
        } finally {
            this.loggerService.debug('>>> Exiting CliInitializationService.onModuleInit');
        }
    }

    private async ensureApiKey(): Promise<void> {
        this.loggerService.debug('>>> Entering ensureApiKey');

        try {
            let config: Record<string, any> = {};
            this.loggerService.debug('>>> [ensureApiKey] Checking config file existence...');

            if (fs.existsSync(CONFIG_FILE)) {
                this.loggerService.debug(`>>> [ensureApiKey] Reading config file: ${CONFIG_FILE}`);

                try {
                    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
                    this.loggerService.debug('>>> [ensureApiKey] Config file parsed.');
                } catch (e) {
                    this.loggerService.error(
                        `>>> [ensureApiKey] Error reading/parsing config file (${CONFIG_FILE}):`,
                        e
                    );
                }
            } else {
                this.loggerService.debug('>>> [ensureApiKey] Config file does not exist.');
            }

            this.loggerService.debug('>>> [ensureApiKey] Getting MODEL_PROVIDER from config facade...');
            const providerResult = this.configFacade.getConfigValue('MODEL_PROVIDER');
            const provider = providerResult.success && providerResult.data ? providerResult.data : PROVIDERS.ANTHROPIC;
            this.loggerService.debug(`>>> [ensureApiKey] Determined provider: ${provider}`);
            const keyName = provider === PROVIDERS.ANTHROPIC ? ENV_KEYS.ANTHROPIC_API_KEY : ENV_KEYS.OPENAI_API_KEY;
            const configKey = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            this.loggerService.debug(`>>> [ensureApiKey] Checking key: ${keyName} (config key: ${configKey})`);
            const apiKey = config[configKey] || process.env[keyName];
            this.loggerService.debug(`>>> [ensureApiKey] Initial API key found? ${!!apiKey}`);

            if (!apiKey) {
                this.loggerService.warn(`>>> [ensureApiKey] ${keyName} is not set in config or environment.`);
                this.loggerService.error(
                    `>>> [ensureApiKey] API Key (${keyName}) is missing. Please configure it using the 'model' command.`
                );
            } else {
                this.loggerService.debug(`>>> [ensureApiKey] ${keyName} found.`);

                if (!process.env[keyName]) {
                    this.loggerService.debug(`>>> [ensureApiKey] Setting process.env.${keyName}`);
                    process.env[keyName] = apiKey;
                } else {
                    this.loggerService.debug(`>>> [ensureApiKey] process.env.${keyName} already set.`);
                }
            }

            if (!process.env[keyName]) {
                this.loggerService.warn(
                    `>>> [ensureApiKey] Failed to ensure ${keyName} is set in the current process environment.`
                );
            } else {
                this.loggerService.debug('>>> [ensureApiKey] API key check passed.');
            }
        } catch (error) {
            this.loggerService.error(
                `>>> Error inside ensureApiKey: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }

        this.loggerService.debug('>>> Exiting ensureApiKey');
    }
}
