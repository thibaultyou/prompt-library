import * as path from 'path';
import dotenv from 'dotenv';

const originalEnv = { ...process.env };
const envTestPath = path.resolve(__dirname, '.env.test');
dotenv.config({ path: envTestPath });

process.env.NODE_ENV = 'test';

export { originalEnv };
