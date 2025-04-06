import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module';

process.env.CLI_ENV = 'cli';

async function bootstrap(): Promise<void> {
    try {
        await CommandFactory.run(AppModule, {
            logger: ['error', 'warn']
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        process.on('uncaughtException', (_error) => {
            console.error('Uncaught Exception:');
            process.exit(1);
        });
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_error) {
        process.exit(1);
    }
}

bootstrap();
