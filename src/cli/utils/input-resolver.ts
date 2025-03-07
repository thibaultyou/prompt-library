import { EnvVariable } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../constants';
import { readEnvVars } from './env-vars';
import { handleError } from './errors';
import { viewFragmentContent } from './fragments';

export async function resolveValue(value: string, envVars: EnvVariable[]): Promise<string> {
    if (value.startsWith(FRAGMENT_PREFIX)) {
        const [category, name] = value.split(FRAGMENT_PREFIX)[1].split('/');
        const fragmentResult = await viewFragmentContent(category, name);

        if (fragmentResult.success && fragmentResult.data) {
            return fragmentResult.data;
        } else {
            logger.warn(`Failed to load fragment: ${category}/${name}`);
            return `<Failed to load fragment: ${category}/${name}>`;
        }
    } else if (value.startsWith(ENV_PREFIX)) {
        const envVarName = value.split(ENV_PREFIX)[1];
        const actualEnvVar = envVars.find((v) => v.name === envVarName);

        if (actualEnvVar) {
            const envVarValue = actualEnvVar.value;

            if (envVarValue.startsWith('$env:')) {
                return await resolveValue(`${ENV_PREFIX}${envVarValue.slice(5)}`, envVars);
            }
            return envVarValue;
        } else {
            logger.warn(`Env var not found: ${envVarName}`);
            return `<Env var not found: ${envVarName}>`;
        }
    }
    return value;
}

export async function resolveInputs(inputs: Record<string, string>): Promise<Record<string, string>> {
    try {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        const resolvedInputs: Record<string, string> = {};

        for (const [key, value] of Object.entries(inputs)) {
            if (value.startsWith(FRAGMENT_PREFIX) || value.startsWith(ENV_PREFIX)) {
                resolvedInputs[key] = await resolveValue(value, envVars);

                // Handle double resolution for environment variables that reference fragments
                if (resolvedInputs[key].startsWith(FRAGMENT_PREFIX)) {
                    logger.info(`Resolving nested fragment in environment variable: ${key}`);
                    resolvedInputs[key] = await resolveValue(resolvedInputs[key], envVars);
                }
            } else {
                resolvedInputs[key] = value;
            }
        }
        return resolvedInputs;
    } catch (error) {
        handleError(error, 'resolving inputs');
        throw error;
    }
}
