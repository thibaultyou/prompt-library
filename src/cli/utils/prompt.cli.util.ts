import { readEnvVars } from './env.util';
import { handleError } from './error.util';
import { viewFragmentContent } from './fragment.util';
import { EnvVar } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { processPromptContent } from '../../shared/utils/prompt_operations';

export async function resolveValue(value: string, envVars: EnvVar[]): Promise<string> {
    if (value.startsWith('Fragment: ')) {
        const [category, name] = value.split('Fragment: ')[1].split('/');
        const fragmentResult = await viewFragmentContent(category, name);

        if (fragmentResult.success && fragmentResult.data) {
            return fragmentResult.data;
        } else {
            logger.warn(`Failed to load fragment: ${category}/${name}`);
            return value;
        }
    } else if (value.startsWith('Env: ')) {
        const envVarName = value.split('Env: ')[1];
        const actualEnvVar = envVars.find((v) => v.name === envVarName);

        if (actualEnvVar) {
            return await resolveValue(actualEnvVar.value, envVars); // Recursive call to handle nested Env: references
        } else {
            logger.warn(`Env var not found: ${envVarName}`);
            return value;
        }
    }
    return value;
}

export async function resolveCliInputs(inputs: Record<string, string>): Promise<Record<string, string>> {
    try {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        const resolvedInputs: Record<string, string> = {};

        for (const [key, value] of Object.entries(inputs)) {
            if (value.startsWith('Fragment: ') || value.startsWith('Env: ')) {
                resolvedInputs[key] = await resolveValue(value, envVars);
            } else {
                resolvedInputs[key] = value;
            }
        }
        return resolvedInputs;
    } catch (error) {
        handleError(error, 'resolving CLI inputs');
        throw error;
    }
}

export async function processCliPromptContent(
    messages: { role: string; content: string }[],
    inputs: Record<string, string> = {},
    useStreaming: boolean = true
): Promise<string> {
    try {
        return processPromptContent(messages, inputs, useStreaming, resolveCliInputs, (event) => {
            if (event.type === 'content_block_delta' && event.delta) {
                if ('text' in event.delta) {
                    process.stdout.write(event.delta.text);
                } else if ('partial_json' in event.delta) {
                    process.stdout.write(event.delta.partial_json);
                }
            }
        });
    } catch (error) {
        handleError(error, 'processing CLI prompt content');
        throw error;
    }
}
