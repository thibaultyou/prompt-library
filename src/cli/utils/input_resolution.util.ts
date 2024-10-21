import { handleError } from './error.util';
import { resolveCliInputs } from './input_processing.util';
import { processPromptContent } from '../../shared/utils/prompt_processing.util';

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
