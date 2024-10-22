import { EnvVar } from '../../shared/types';
import logger from '../../shared/utils/logger.util';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../cli.constants';
import { readEnvVars } from './env.util';
import { handleError } from './error.util';
import { viewFragmentContent } from './fragment_operations.util';

export async function resolveValue(value: string, envVars: EnvVar[]): Promise<string> {
    if (value.startsWith(FRAGMENT_PREFIX)) {
        const [category, name] = value.split(FRAGMENT_PREFIX)[1].split('/');
        const fragmentResult = await viewFragmentContent(category, name);

        if (fragmentResult.success && fragmentResult.data) {
            return fragmentResult.data;
        } else {
            logger.warn(`Failed to load fragment: ${category}/${name}`);
            return value;
        }
    } else if (value.startsWith(ENV_PREFIX)) {
        const envVarName = value.split(ENV_PREFIX)[1];
        const actualEnvVar = envVars.find((v) => v.name === envVarName);

        if (actualEnvVar) {
            return await resolveValue(actualEnvVar.value, envVars);
        } else {
            logger.warn(`Env var not found: ${envVarName}`);
            return value;
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
