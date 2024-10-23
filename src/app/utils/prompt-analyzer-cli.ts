import { analyzePrompt } from './analyze-prompt';
import { readFileContent } from '../../shared/utils/file-system';

export async function runPromptAnalyzerFromCLI(args: string[]): Promise<void> {
    const promptPath = args[0];

    if (!promptPath) {
        console.error('Please provide a path to the prompt file as an argument');
        process.exit(1);
    }

    try {
        const promptContent = await readFileContent(promptPath);
        const metadata = await analyzePrompt(promptContent);
        console.log('Generated Metadata:');
        console.log(JSON.stringify(metadata, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runPromptAnalyzerFromCLI(process.argv.slice(2));
}
