module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleNameMapper: {
        '^@config(.*)$': '<rootDir>/src/config$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@types(.*)$': '<rootDir>/src/types$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1'
    }
};
