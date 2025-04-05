import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module';

process.env.CLI_ENV = 'cli';

async function bootstrap() {
    try {
        await CommandFactory.run(AppModule, {
            logger: ['error', 'warn']
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            process.exit(1);
        });
    } catch (error) {
        process.exit(1);
    }
}

bootstrap();
