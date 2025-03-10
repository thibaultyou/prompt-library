import path from 'path';

import { select, confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import fs from 'fs-extra';

import { updatePromptMetadata } from '../../app/controllers/update-metadata';
import { analyzePrompt } from '../../app/utils/analyze-prompt';
import { getConfig } from '../../shared/config';
import { dumpYaml, generateContentHash, parseYaml } from '../../shared/utils/file-system';
import logger from '../../shared/utils/logger';
import { extractVariablesFromPrompt } from '../../shared/utils/prompt-processing';
import {
    getPromptById,
    listPromptDirectories,
    removePromptFromDatabase,
    syncPromptsWithDatabase,
    syncSpecificPromptWithDatabase
} from '../utils/database';
import { stagePromptChanges } from '../utils/library-repository';
import { selectPrompt } from '../utils/prompts';
import { editInEditor } from '../utils/prompts-simple';
import { clearPendingChanges, createBranchAndPushChanges, trackPromptChange } from '../utils/sync-utils';
import { showSpinner, getInput } from '../utils/ui-components';

interface SimplePromptMetadata {
    title: string;
    directory: string;
    primary_category: string;
    subcategories: string[];
    one_line_description: string;
    description: string;
    tags: string[];
    variables: any[];
    content_hash: string;
    fragments?: any[];
}

async function loadPromptForEditing(promptIdentifier: string): Promise<SimplePromptMetadata | null> {
    try {
        const directories = await listPromptDirectories();
        let promptDir = '';

        if (!isNaN(Number(promptIdentifier))) {
            const prompt = await getPromptById(parseInt(promptIdentifier, 10));

            if (!prompt) {
                logger.error(`Prompt with ID ${promptIdentifier} not found`);
                return null;
            }

            promptDir = prompt.directory;
        } else {
            promptDir = promptIdentifier;

            if (!directories.includes(promptDir)) {
                logger.error(`Prompt directory "${promptDir}" not found`);
                return null;
            }
        }

        const metadataPath = path.join(getConfig().PROMPTS_DIR, promptDir, 'metadata.yml');

        if (!(await fs.pathExists(metadataPath))) {
            logger.error(`Metadata file not found in directory "${promptDir}"`);
            return null;
        }

        const metadata = await parseYaml<SimplePromptMetadata>(metadataPath);
        logger.info(`Editing prompt: ${metadata.title}`);
        return { ...metadata, directory: promptDir };
    } catch (error) {
        logger.error('Failed to load prompt for editing:', error);
        return null;
    }
}

async function collectInitialMetadata(options: any): Promise<SimplePromptMetadata> {
    let title = options.title;

    if (!title) {
        title = await getInput('Enter prompt title:');
    }

    let directory = options.directory;

    if (!directory) {
        directory = await getInput('Enter directory name (snake_case):');
        directory = directory
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    let primaryCategory = options.category;

    if (!primaryCategory) {
        primaryCategory = await selectCategory();
    }

    let oneLineDescription = options.description;

    if (!oneLineDescription) {
        oneLineDescription = await getInput('Enter one-line description:');
    }
    return {
        title,
        directory,
        primary_category: primaryCategory,
        subcategories: [],
        one_line_description: oneLineDescription,
        description: '',
        tags: [],
        variables: [],
        content_hash: ''
    };
}

async function selectCategory(): Promise<string> {
    const categories = [
        // Original core categories
        'analysis', // Data and information analysis
        'art_and_design', // Visual and aesthetic creation
        'business', // Business operations and strategy
        'coding', // Development, programming, and software engineering
        'content_creation', // Documentation, writing, and creative content
        'customer_service', // Support and client communication
        'data_processing', // Data analysis, visualization, transformation
        'education', // Teaching, learning, and knowledge sharing
        'entertainment', // Recreation, gaming, media consumption
        'finance', // Money management and financial planning
        'gaming', // Game design, playing, and strategies
        'healthcare', // Health, wellness, medicine, fitness
        'language', // Language learning, linguistics
        'legal', // Law, compliance, and legal documents
        'marketing', // Promotion, advertising, brand development
        'music', // Music creation, theory, and production
        'personal_assistant', // Task management and daily support
        'problem_solving', // General problem analysis and solution frameworks
        'productivity', // Efficiency, workflow optimization
        'prompt_engineering', // Creating and optimizing AI prompts
        'research', // Academic or professional research assistance
        'science', // Scientific inquiry and methodology
        'social_media', // Online platform content and strategy
        'translation', // Text, concept, or knowledge translation
        'writing', // Written content creation

        // Additional categories
        'personal_growth', // Self-improvement, life coaching
        'communication', // Interpersonal skills, writing, messaging
        'creative', // Creative expression across mediums
        'specialized' // Domain-specific agents that don't fit elsewhere
    ];
    const categoryChoices = categories.map((category) => ({
        name: category.padEnd(20) + '- ' + getCategoryDescription(category),
        value: category
    }));
    return select({
        message: 'Select a primary category:',
        choices: categoryChoices
    });
}

function getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        analysis: 'Data and information analysis',
        art_and_design: 'Visual and aesthetic creation',
        business: 'Business operations and strategy',
        coding: 'Development, programming, and software engineering',
        content_creation: 'Documentation, writing, and creative content',
        customer_service: 'Support and client communication',
        data_processing: 'Data analysis, visualization, transformation',
        education: 'Teaching, learning, and knowledge sharing',
        entertainment: 'Recreation, gaming, media consumption',
        finance: 'Money management and financial planning',
        gaming: 'Game design, playing, and strategies',
        healthcare: 'Health, wellness, medicine, fitness',
        language: 'Language learning, linguistics',
        legal: 'Law, compliance, and legal documents',
        marketing: 'Promotion, advertising, brand development',
        music: 'Music creation, theory, and production',
        personal_assistant: 'Task management and daily support',
        problem_solving: 'General problem analysis and solution frameworks',
        productivity: 'Efficiency, workflow optimization',
        prompt_engineering: 'Creating and optimizing AI prompts',
        research: 'Academic or professional research assistance',
        science: 'Scientific inquiry and methodology',
        social_media: 'Online platform content and strategy',
        translation: 'Text, concept, or knowledge translation',
        writing: 'Written content creation',
        personal_growth: 'Self-improvement, life coaching',
        communication: 'Interpersonal skills, writing, messaging',
        creative: 'Creative expression across mediums',
        specialized: "Domain-specific agents that don't fit elsewhere"
    };
    return descriptions[category] || category;
}

async function collectPromptContent(metadata: SimplePromptMetadata): Promise<string> {
    let content = '';
    const promptDir = path.join(getConfig().PROMPTS_DIR, metadata.directory);
    const promptPath = path.join(promptDir, 'prompt.md');

    if (await fs.pathExists(promptPath)) {
        content = await fs.readFile(promptPath, 'utf8');
        logger.info('Current prompt content loaded. Opening in editor...');

        const newContent = await editInEditor(content, {
            message: 'Edit the prompt content (it will open in your default editor):',
            postfix: '.md'
        });
        return newContent || content;
    } else {
        logger.info('Opening editor for new prompt content...');

        const templateContent = `# Your Prompt Title

## Instructions
Enter your prompt content here. 

You can use variables with {{VARIABLE_NAME}} syntax.

## Example Input/Output
- Input: Sample input
- Output: Sample output`;
        const newContent = await editInEditor(templateContent, {
            message: 'Create your prompt content (it will open in your default editor):',
            postfix: '.md'
        });
        return newContent || '';
    }
}

async function analyzeAndGenerateMetadata(metadata: SimplePromptMetadata, content: string): Promise<boolean> {
    const chalk = (await import('chalk')).default;
    const spinner = showSpinner('Analyzing prompt with the prompt_analysis_agent...');

    try {
        const extractedVariables = extractVariablesFromPrompt(content);
        const analyzedMetadata = await analyzePrompt(content);

        if (!analyzedMetadata) {
            spinner.fail('AI analysis failed');
            logger.warn('AI analysis failed. Using manual metadata.');

            const shouldRetry = await confirm({
                message: 'Would you like to retry the AI analysis?',
                default: true
            });

            if (shouldRetry) {
                return false;
            }

            console.log(chalk.yellow('Continuing with manual metadata...'));
            return true;
        }

        Object.assign(metadata, {
            ...analyzedMetadata,
            title: metadata.title || analyzedMetadata.title,
            primary_category: metadata.primary_category || analyzedMetadata.primary_category,
            directory: metadata.directory || analyzedMetadata.directory,
            one_line_description: metadata.one_line_description || analyzedMetadata.one_line_description,
            variables: analyzedMetadata.variables || extractedVariables,
            subcategories: analyzedMetadata.subcategories || metadata.subcategories,
            tags: analyzedMetadata.tags || metadata.tags,
            description: analyzedMetadata.description || metadata.description,
            fragments: analyzedMetadata.fragments || metadata.fragments
        });

        updatePromptMetadata(metadata.directory).catch((err) => {
            logger.warn(`Failed to update metadata hash for ${metadata.directory}:`, err);
        });

        spinner.succeed('Prompt analyzed successfully');
        logger.info('Generated metadata using the same agent used in CI workflows');
        return true;
    } catch (error) {
        spinner.fail('Failed to analyze prompt');
        logger.error('Error during prompt analysis:', error);

        console.log(chalk.red('\nError details:'));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));

        const shouldRetry = await confirm({
            message: 'Would you like to retry the AI analysis?',
            default: true
        });

        if (shouldRetry) {
            return false;
        }

        console.log(chalk.yellow('\nContinuing with manual metadata...'));
        return true;
    }
}

async function savePromptFiles(metadata: SimplePromptMetadata, content: string): Promise<void> {
    try {
        const promptDir = path.join(getConfig().PROMPTS_DIR, metadata.directory);
        const promptPath = path.join(promptDir, 'prompt.md');
        const metadataPath = path.join(promptDir, 'metadata.yml');
        const readmePath = path.join(promptDir, 'README.md');
        await fs.ensureDir(promptDir);

        await fs.writeFile(promptPath, content);

        metadata.content_hash = await generateContentHash(content);

        await fs.writeFile(metadataPath, dumpYaml(metadata));

        if (!(await fs.pathExists(readmePath))) {
            await fs.writeFile(readmePath, `# ${metadata.title}\n\n${metadata.one_line_description}\n`);
        }

        logger.info('Prompt files saved successfully');
    } catch (error) {
        logger.error('Failed to save prompt files:', error);
        throw error;
    }
}

async function updateDatabase(directoryName?: string): Promise<void> {
    const spinner = showSpinner('Updating database...');

    try {
        if (directoryName) {
            await syncSpecificPromptWithDatabase(directoryName);
            spinner.stop(true);
            logger.info(`Database updated successfully for ${directoryName}`);
        } else {
            await syncPromptsWithDatabase();
            spinner.stop(true);
            logger.info('Database updated successfully');
        }
    } catch (error) {
        spinner.stop(true);
        logger.error('Error updating database:', error);
        throw error;
    }
}

async function offerRemoteSync(): Promise<void> {
    const doSync = await confirm({
        message: 'Would you like to sync this prompt to the remote repository now?',
        default: false
    });

    if (doSync) {
        try {
            const spinner = showSpinner('Syncing to remote repository...');
            const branchName = `prompt/${Date.now()}`;
            await createBranchAndPushChanges(branchName);

            await clearPendingChanges();

            spinner.succeed('Changes pushed to remote repository');
            logger.info(`Created branch: ${branchName}`);
            logger.info('Please create a pull request on the repository to merge your changes.');
        } catch (error) {
            logger.error('Failed to sync to remote repository:', error);
        }
    } else {
        logger.info('Changes will be tracked and you can sync them later using "prompt-library-cli sync --push"');
    }
}

const createCommand = new Command('create')
    .description('Create a new prompt')
    .option('-d, --directory <name>', 'Directory name for the new prompt (snake_case)')
    .option('--title <title>', 'Title for the new prompt')
    .option('--category <category>', 'Primary category for the prompt')
    .option('--description <description>', 'One-line description for the prompt')
    .option('--no-analyze', 'Skip AI analysis of prompt to generate metadata (uses prompt_analysis_agent)')
    .action(async (options) => {
        try {
            const promptData = await collectInitialMetadata(options);
            const promptContent = await collectPromptContent(promptData);

            if (!promptContent || promptContent.trim() === '') {
                logger.error('Prompt content cannot be empty');
                return;
            }

            if (options.analyze !== false) {
                let analysisComplete = false;
                while (!analysisComplete) {
                    analysisComplete = await analyzeAndGenerateMetadata(promptData, promptContent);
                }
            }

            await savePromptFiles(promptData, promptContent);

            await updateDatabase(promptData.directory);

            await trackPromptChange(promptData.directory, 'add', promptData.title);

            await stagePromptChanges(promptData.directory);

            logger.info(`Prompt "${promptData.title}" successfully created`);
            logger.info(`Located at: ${path.join(getConfig().PROMPTS_DIR, promptData.directory)}`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to create prompt:', error);
        }
    });
const editCommand = new Command('edit')
    .description('Edit an existing prompt')
    .option('-p, --prompt <promptId>', 'ID or directory name of the prompt to edit')
    .argument('[promptId]', 'ID or directory name of the prompt to edit')
    .option('--no-analyze', 'Skip AI analysis of prompt to generate metadata (uses prompt_analysis_agent)')
    .action(async (promptId, options) => {
        try {
            const promptIdentifier = promptId || options.prompt;
            let promptToEdit = promptIdentifier;

            if (!promptIdentifier) {
                const selectedPrompt = await selectPrompt();

                if (!selectedPrompt) {
                    logger.error('No prompt selected. Exiting.');
                    return;
                }

                promptToEdit = selectedPrompt.id.toString();
            }

            const promptData = await loadPromptForEditing(promptToEdit);

            if (!promptData) {
                return;
            }

            const promptContent = await collectPromptContent(promptData);

            if (!promptContent || promptContent.trim() === '') {
                logger.error('Prompt content cannot be empty');
                return;
            }

            if (options.analyze !== false) {
                let analysisComplete = false;
                while (!analysisComplete) {
                    analysisComplete = await analyzeAndGenerateMetadata(promptData, promptContent);
                }
            }

            await savePromptFiles(promptData, promptContent);

            await updateDatabase(promptData.directory);

            await trackPromptChange(promptData.directory, 'modify', promptData.title);

            await stagePromptChanges(promptData.directory);

            logger.info(`Prompt "${promptData.title}" successfully updated`);
            logger.info(`Located at: ${path.join(getConfig().PROMPTS_DIR, promptData.directory)}`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to edit prompt:', error);
        }
    });
const deleteCommand = new Command('delete')
    .description('Delete an existing prompt')
    .option('-p, --prompt <promptId>', 'ID or directory name of the prompt to delete')
    .argument('[promptId]', 'ID or directory name of the prompt to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (promptId, options) => {
        try {
            const promptIdentifier = promptId || options.prompt;
            let promptToDelete = promptIdentifier;

            if (!promptIdentifier) {
                const selectedPrompt = await selectPrompt();

                if (!selectedPrompt) {
                    logger.error('No prompt selected. Exiting.');
                    return;
                }

                promptToDelete = selectedPrompt.id.toString();
            }

            const promptData = await loadPromptForEditing(promptToDelete);

            if (!promptData) {
                return;
            }

            if (!options.force) {
                const shouldDelete = await confirm({
                    message: `Are you sure you want to delete the prompt "${promptData.title}"? This cannot be undone.`,
                    default: false
                });

                if (!shouldDelete) {
                    logger.info('Deletion cancelled.');
                    return;
                }
            }

            const promptDir = path.join(getConfig().PROMPTS_DIR, promptData.directory);
            await fs.remove(promptDir);

            await trackPromptChange(promptData.directory, 'delete', promptData.title);
            await stagePromptChanges(promptData.directory);
            await removePromptFromDatabase(promptData.directory);

            logger.info(`Prompt "${promptData.title}" successfully deleted`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to delete prompt:', error);
        }
    });

export { createCommand, deleteCommand, editCommand };
