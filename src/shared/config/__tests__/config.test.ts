/* eslint-disable @typescript-eslint/no-require-imports */
import * as path from 'path';

describe('Config', () => {
    let originalEnv: NodeJS.ProcessEnv;
    beforeAll(() => {
        originalEnv = { ...process.env };
    });

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.CLI_ENV = 'cli';

        jest.resetModules();

        jest.mock('fs', () => ({
            existsSync: jest.fn(() => false),
            readFileSync: jest.fn(() => '{}'),
            writeFileSync: jest.fn(),
            mkdirSync: jest.fn()
        }));

        jest.mock('../constants', () => ({
            get isCliEnvironment(): boolean {
                return process.env.CLI_ENV === 'cli';
            },
            CONFIG_DIR: '/mock/config/dir',
            CONFIG_FILE: '/mock/config/dir/config.json'
        }));

        jest.mock('../common-config', () => ({
            commonConfig: {
                ANTHROPIC_API_KEY: undefined,
                ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620',
                ANTHROPIC_MAX_TOKENS: 8000,
                PROMPT_FILE_NAME: 'prompt.md',
                METADATA_FILE_NAME: 'metadata.yml',
                LOG_LEVEL: 'info',
                REMOTE_REPOSITORY: '',
                CLI_ENV: 'cli'
            }
        }));

        jest.mock('../../../cli/config/cli-config', () => {
            const mockConfigDir = '/mock/config/dir';
            return {
                cliConfig: {
                    PROMPTS_DIR: 'prompts',
                    FRAGMENTS_DIR: 'fragments',
                    DB_PATH: path.join(mockConfigDir, 'prompts.sqlite'),
                    TEMP_DIR: path.join(mockConfigDir, 'temp'),
                    MENU_PAGE_SIZE: 20
                }
            };
        });
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('getConfig', () => {
        it('should return default config when no file exists', () => {
            process.env.CLI_ENV = 'cli';

            const mockFs = require('fs');
            mockFs.existsSync.mockReturnValue(false);
            mockFs.readFileSync.mockReturnValue('{}');

            const { getConfig } = require('../../config');
            const config = getConfig();
            expect(config.ANTHROPIC_API_KEY).toBeUndefined();
            expect(config).toMatchObject({
                ANTHROPIC_MAX_TOKENS: 8000,
                ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620',
                CLI_ENV: 'cli'
            });
        });

        it('should merge file config with default config', () => {
            process.env.CLI_ENV = 'cli';

            const mockFs = require('fs');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    ANTHROPIC_API_KEY: 'file-key'
                })
            );

            const { getConfig } = require('../../config');
            const config = getConfig();
            expect(config.ANTHROPIC_API_KEY).toBe('file-key');
        });
    });

    describe('getConfigValue', () => {
        it('should prefer process.env value in non-CLI environment', () => {
            process.env.CLI_ENV = 'app';
            process.env.ANTHROPIC_API_KEY = 'env-key';

            const mockFs = require('fs');
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    ANTHROPIC_API_KEY: 'file-key'
                })
            );

            const { getConfigValue, clearConfigCache } = require('../../config');
            clearConfigCache();

            const value = getConfigValue('ANTHROPIC_API_KEY');
            expect(value).toBe('env-key');
        });

        it('should use file value in CLI environment even if env var exists', () => {
            process.env.CLI_ENV = 'cli';
            process.env.ANTHROPIC_API_KEY = 'env-key';

            const mockFs = require('fs');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    ANTHROPIC_API_KEY: 'file-key'
                })
            );

            const { getConfigValue, clearConfigCache } = require('../../config');
            clearConfigCache();

            const value = getConfigValue('ANTHROPIC_API_KEY');
            expect(value).toBe('file-key');
        });

        it('should return updated value after setConfig', () => {
            process.env.CLI_ENV = 'cli';

            const mockFs = require('fs');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    ANTHROPIC_API_KEY: 'initial-key'
                })
            );

            const { setConfig, getConfigValue, clearConfigCache } = require('../../config');
            clearConfigCache();

            expect(getConfigValue('ANTHROPIC_API_KEY')).toBe('initial-key');

            setConfig('ANTHROPIC_API_KEY', 'updated-key');

            expect(getConfigValue('ANTHROPIC_API_KEY')).toBe('updated-key');
            expect(process.env.ANTHROPIC_API_KEY).toBe('updated-key');
        });
    });

    describe('setConfig', () => {
        it('should throw error if not in CLI environment', () => {
            process.env.CLI_ENV = 'app';

            const { setConfig } = require('../../config');
            expect(() => setConfig('ANTHROPIC_API_KEY', 'new-key')).toThrow();
        });

        it('should update config file and process.env', () => {
            process.env.CLI_ENV = 'cli';

            const mockFs = require('fs');
            mockFs.existsSync.mockReturnValue(true);

            const { setConfig } = require('../../config');
            setConfig('ANTHROPIC_API_KEY', 'new-key');

            expect(mockFs.writeFileSync).toHaveBeenCalledWith('/mock/config/dir/config.json', expect.any(String));
            expect(process.env.ANTHROPIC_API_KEY).toBe('new-key');
        });
    });

    describe('environment specific behavior', () => {
        it('should prefer env vars in non-CLI environment', () => {
            process.env.CLI_ENV = 'app';
            process.env.ANTHROPIC_API_KEY = 'env-key';

            const mockFs = require('fs');
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    ANTHROPIC_API_KEY: 'file-key'
                })
            );

            const { getConfigValue, clearConfigCache } = require('../../config');
            clearConfigCache();

            const value = getConfigValue('ANTHROPIC_API_KEY');
            expect(value).toBe('env-key');
        });
    });
});
