import logger from '../logger';

jest.mock('../../config/common-config', () => ({
    commonConfig: {
        LOG_LEVEL: 'debug'
    }
}));

describe('LoggerUtils', () => {
    let consoleSpy: jest.SpyInstance;
    const originalEnv = process.env;
    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.LOG_LEVEL;

        logger.setLogLevel('debug');

        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        process.env = originalEnv;
    });

    describe('log levels', () => {
        it('should log at info level', () => {
            logger.setLogLevel('info');
            logger.info('test message');
            expect(consoleSpy).toHaveBeenCalled();
            const logMessage = consoleSpy.mock.calls[0][0];
            expect(logMessage).toContain('[INFO]');
        });

        it('should log at error level', () => {
            logger.setLogLevel('error');
            logger.error('test error');
            expect(consoleSpy).toHaveBeenCalled();
            const logMessage = consoleSpy.mock.calls[0][0];
            expect(logMessage).toContain('[ERROR]');
        });

        it('should log at warn level', () => {
            logger.setLogLevel('warn');
            logger.warn('test warning');
            expect(consoleSpy).toHaveBeenCalled();
            const logMessage = consoleSpy.mock.calls[0][0];
            expect(logMessage).toContain('[WARN]');
        });

        it('should log at debug level', () => {
            logger.setLogLevel('debug');
            logger.debug('test debug');
            expect(consoleSpy).toHaveBeenCalled();
            const logMessage = consoleSpy.mock.calls[0][0];
            expect(logMessage).toContain('[DEBUG]');
        });
    });

    describe('setLogLevel', () => {
        it('should respect log level settings', () => {
            logger.setLogLevel('error');

            logger.debug('test debug');
            expect(consoleSpy).not.toHaveBeenCalled();

            logger.info('test info');
            expect(consoleSpy).not.toHaveBeenCalled();

            logger.warn('test warn');
            expect(consoleSpy).not.toHaveBeenCalled();

            logger.error('test error');
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toContain('[ERROR]');
        });

        it('should allow all logs at debug level', () => {
            logger.setLogLevel('debug');

            logger.debug('test debug');
            logger.info('test info');
            logger.warn('test warn');
            logger.error('test error');

            expect(consoleSpy).toHaveBeenCalledTimes(4);
            expect(consoleSpy.mock.calls[0][0]).toContain('[DEBUG]');
            expect(consoleSpy.mock.calls[1][0]).toContain('[INFO]');
            expect(consoleSpy.mock.calls[2][0]).toContain('[WARN]');
            expect(consoleSpy.mock.calls[3][0]).toContain('[ERROR]');
        });
    });
});
