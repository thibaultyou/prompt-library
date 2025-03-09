import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Command } from 'commander';
import { createBranchAndPushChanges } from '../utils/sync-utils';
import { showSpinner, getInput, getMultilineInput } from '../utils/ui-components';
import { analyzePrompt } from '../../app/utils/analyze-prompt';
import { getConfig } from '../../shared/config';
import { extractVariablesFromPrompt } from '../../shared/utils/prompt-processing';
import logger from '../../shared/utils/logger';

// Define simplified metadata type for the prompt
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

/**
 * Load an existing prompt for editing
 */
async function loadPromptForEditing(promptIdentifier: string): Promise<SimplePromptMetadata | null> {
    try {
        // Check if prompt exists by directory name or ID
        const fs = await import('fs-extra');
        const { listPromptDirectories } = await import('../utils/database');
        
        const directories = await listPromptDirectories();
        let promptDir = '';

        if (!isNaN(Number(promptIdentifier))) {
            // Find by ID from database
            const database = await import('../utils/database');
            const prompt = await database.getPromptById(parseInt(promptIdentifier, 10));
            if (!prompt) {
                logger.error(`Prompt with ID ${promptIdentifier} not found`);
                return null;
            }
            promptDir = prompt.directory;
        } else {
            // Find by directory name
            promptDir = promptIdentifier;
            if (!directories.includes(promptDir)) {
                logger.error(`Prompt directory "${promptDir}" not found`);
                return null;
            }
        }

        const metadataPath = path.join(getConfig().PROMPTS_DIR, promptDir, 'metadata.yml');
        if (!await fs.pathExists(metadataPath)) {
            logger.error(`Metadata file not found in directory "${promptDir}"`);
            return null;
        }

        // Parse metadata
        const fileSystem = await import('../../shared/utils/file-system');
        const metadata = await fileSystem.parseYaml<SimplePromptMetadata>(metadataPath);
        
        logger.info(`Editing prompt: ${metadata.title}`);
        return { ...metadata, directory: promptDir };
    } catch (error) {
        logger.error('Failed to load prompt for editing:', error);
        return null;
    }
}

/**
 * Collect initial metadata for a new prompt
 */
async function collectInitialMetadata(options: any): Promise<SimplePromptMetadata> {
    // Get title
    let title = options.title;
    if (!title) {
        title = await getInput('Enter prompt title:');
    }
    
    // Get directory name
    let directory = options.directory;
    if (!directory) {
        directory = await getInput('Enter directory name (snake_case):');
        // Convert to snake_case if needed
        directory = directory.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    
    // Get category
    let primaryCategory = options.category;
    if (!primaryCategory) {
        primaryCategory = await selectCategory();
    }
    
    // Get one-line description
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

/**
 * Select a category from available categories in the prompt_analysis_agent
 */
async function selectCategory(): Promise<string> {
    const { input, select } = await import('@inquirer/prompts');
    
    // Categories from prompt_analysis_agent/prompt.md
    const categories = [
        // Original core categories
        'analysis',         // Data and information analysis
        'art_and_design',   // Visual and aesthetic creation
        'business',         // Business operations and strategy
        'coding',           // Development, programming, and software engineering
        'content_creation', // Documentation, writing, and creative content
        'customer_service', // Support and client communication
        'data_processing',  // Data analysis, visualization, transformation
        'education',        // Teaching, learning, and knowledge sharing
        'entertainment',    // Recreation, gaming, media consumption
        'finance',          // Money management and financial planning
        'gaming',           // Game design, playing, and strategies
        'healthcare',       // Health, wellness, medicine, fitness
        'language',         // Language learning, linguistics
        'legal',            // Law, compliance, and legal documents
        'marketing',        // Promotion, advertising, brand development
        'music',            // Music creation, theory, and production
        'personal_assistant', // Task management and daily support
        'problem_solving',  // General problem analysis and solution frameworks
        'productivity',     // Efficiency, workflow optimization
        'prompt_engineering', // Creating and optimizing AI prompts
        'research',         // Academic or professional research assistance
        'science',          // Scientific inquiry and methodology
        'social_media',     // Online platform content and strategy
        'translation',      // Text, concept, or knowledge translation
        'writing',          // Written content creation
        
        // Additional categories
        'personal_growth',  // Self-improvement, life coaching
        'communication',    // Interpersonal skills, writing, messaging
        'creative',         // Creative expression across mediums
        'specialized'       // Domain-specific agents that don't fit elsewhere
    ];
    
    const categoryChoices = categories.map(category => ({
        name: category.padEnd(20) + '- ' + 
              getCategoryDescription(category),
        value: category
    }));
    
    return select({
        message: 'Select a primary category:',
        choices: categoryChoices
    });
}

/**
 * Get a description for a category
 */
function getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        'analysis': 'Data and information analysis',
        'art_and_design': 'Visual and aesthetic creation',
        'business': 'Business operations and strategy',
        'coding': 'Development, programming, and software engineering',
        'content_creation': 'Documentation, writing, and creative content',
        'customer_service': 'Support and client communication',
        'data_processing': 'Data analysis, visualization, transformation',
        'education': 'Teaching, learning, and knowledge sharing',
        'entertainment': 'Recreation, gaming, media consumption',
        'finance': 'Money management and financial planning',
        'gaming': 'Game design, playing, and strategies',
        'healthcare': 'Health, wellness, medicine, fitness',
        'language': 'Language learning, linguistics',
        'legal': 'Law, compliance, and legal documents',
        'marketing': 'Promotion, advertising, brand development',
        'music': 'Music creation, theory, and production',
        'personal_assistant': 'Task management and daily support',
        'problem_solving': 'General problem analysis and solution frameworks',
        'productivity': 'Efficiency, workflow optimization',
        'prompt_engineering': 'Creating and optimizing AI prompts',
        'research': 'Academic or professional research assistance',
        'science': 'Scientific inquiry and methodology',
        'social_media': 'Online platform content and strategy',
        'translation': 'Text, concept, or knowledge translation',
        'writing': 'Written content creation',
        'personal_growth': 'Self-improvement, life coaching',
        'communication': 'Interpersonal skills, writing, messaging',
        'creative': 'Creative expression across mediums',
        'specialized': 'Domain-specific agents that don\'t fit elsewhere'
    };
    
    return descriptions[category] || category;
}

/**
 * Collect prompt content
 */
async function collectPromptContent(metadata: SimplePromptMetadata): Promise<string> {
    let content = '';
    const promptDir = path.join(getConfig().PROMPTS_DIR, metadata.directory);
    const promptPath = path.join(promptDir, 'prompt.md');
    
    // If editing, load existing content
    if (await fs.pathExists(promptPath)) {
        content = await fs.readFile(promptPath, 'utf8');
        logger.info('Current prompt content loaded. Opening in editor...');
        
        // Open the content in the default editor
        const { editInEditor } = await import('../utils/prompts-simple');
        const newContent = await editInEditor(content, {
            message: 'Edit the prompt content (it will open in your default editor):',
            postfix: '.md'
        });
        
        // No temporary file to clean up with editInEditor
        
        return newContent || content;
    } else {
        logger.info('Opening editor for new prompt content...');
        
        // For new content, use editor with a helpful template
        const templateContent = `# Your Prompt Title

## Instructions
Enter your prompt content here. 

You can use variables with {{VARIABLE_NAME}} syntax.

## Example Input/Output
- Input: Sample input
- Output: Sample output`;

        // Open the content in the default editor
        const { editInEditor } = await import('../utils/prompts-simple');
        const newContent = await editInEditor(templateContent, {
            message: 'Create your prompt content (it will open in your default editor):',
            postfix: '.md'
        });
        
        return newContent || '';
    }
}

/**
 * Generate metadata using AI
 * This leverages the same prompt_analysis_agent used in CI with GitHub Actions
 */
async function analyzeAndGenerateMetadata(metadata: SimplePromptMetadata, content: string): Promise<void> {
    const spinner = showSpinner('Analyzing prompt with the prompt_analysis_agent...');
    
    try {
        // Extract variables from prompt content as fallback
        const extractedVariables = extractVariablesFromPrompt(content);
        
        // Call analyze-prompt to generate metadata using the prompt_analysis_agent
        // This uses the same agent as in the CI pipeline via update-metadata.ts
        const analyzedMetadata = await analyzePrompt(content);
        if (!analyzedMetadata) {
            logger.warn('AI analysis failed. Using manual metadata.');
            spinner.stop(true);
            return;
        }
        
        // Merge analyzed metadata with user-provided data, prioritizing user input
        Object.assign(metadata, {
            ...analyzedMetadata,
            // Preserve user-provided values if they exist
            title: metadata.title || analyzedMetadata.title,
            primary_category: metadata.primary_category || analyzedMetadata.primary_category,
            directory: metadata.directory || analyzedMetadata.directory,
            one_line_description: metadata.one_line_description || analyzedMetadata.one_line_description,
            variables: analyzedMetadata.variables || extractedVariables,
            // Take these from AI analysis since they require more domain knowledge
            subcategories: analyzedMetadata.subcategories || metadata.subcategories,
            tags: analyzedMetadata.tags || metadata.tags,
            description: analyzedMetadata.description || metadata.description,
            fragments: analyzedMetadata.fragments || metadata.fragments
        });
        
        // Run metadata update for this specific prompt using the controller
        // This is more efficient than running update-metadata on all prompts
        const { updatePromptMetadata } = await import('../../app/controllers/update-metadata');
        
        // We don't await this since it's just for content_hash generation,
        // and we'll be updating the database right after this anyway
        updatePromptMetadata(metadata.directory).catch(err => {
            logger.warn(`Failed to update metadata hash for ${metadata.directory}:`, err);
        });
        
        spinner.succeed('Prompt analyzed successfully');
        logger.info('Generated metadata using the same agent used in CI workflows');
    } catch (error) {
        spinner.fail('Failed to analyze prompt');
        logger.error('Error during prompt analysis:', error);
    }
}

/**
 * Save prompt files to disk
 */
async function savePromptFiles(metadata: SimplePromptMetadata, content: string): Promise<void> {
    try {
        const promptDir = path.join(getConfig().PROMPTS_DIR, metadata.directory);
        const promptPath = path.join(promptDir, 'prompt.md');
        const metadataPath = path.join(promptDir, 'metadata.yml');
        const readmePath = path.join(promptDir, 'README.md');
        
        // Ensure directory exists
        await fs.ensureDir(promptDir);
        
        // Write prompt.md
        await fs.writeFile(promptPath, content);
        
        // Generate content hash
        const fileSystem = await import('../../shared/utils/file-system');
        metadata.content_hash = await fileSystem.generateContentHash(content);
        
        // Write metadata.yml
        await fs.writeFile(metadataPath, fileSystem.dumpYaml(metadata));
        
        // Create basic README.md if it doesn't exist
        if (!await fs.pathExists(readmePath)) {
            await fs.writeFile(readmePath, `# ${metadata.title}\n\n${metadata.one_line_description}\n`);
        }
        
        logger.info('Prompt files saved successfully');
    } catch (error) {
        logger.error('Failed to save prompt files:', error);
        throw error;
    }
}

/**
 * Update database with new prompt data
 */
async function updateDatabase(directoryName?: string): Promise<void> {
    const spinner = showSpinner('Updating database...');
    try {
        // Import syncPromptsWithDatabase dynamically
        const database = await import('../utils/database');
        
        if (directoryName) {
            // Only sync the specific prompt that was edited
            await database.syncSpecificPromptWithDatabase(directoryName);
            spinner.stop(true);
            logger.info(`Database updated successfully for ${directoryName}`);
        } else {
            // Sync all prompts (legacy behavior)
            await database.syncPromptsWithDatabase();
            spinner.stop(true);
            logger.info('Database updated successfully');
        }
    } catch (error) {
        spinner.stop(true);
        logger.error('Error updating database:', error);
        throw error;
    }
}

/**
 * Offer to sync changes to remote repository
 */
async function offerRemoteSync(): Promise<void> {
    const { confirm } = await import('@inquirer/prompts');
    
    const doSync = await confirm({
        message: 'Would you like to sync this prompt to the remote repository now?',
        default: false
    });
    
    if (doSync) {
        try {
            const spinner = showSpinner('Syncing to remote repository...');
            const branchName = `prompt/${Date.now()}`;
            
            await createBranchAndPushChanges(branchName);
            
            // Clear pending changes after successful sync
            const { clearPendingChanges } = await import('../utils/sync-utils');
            await clearPendingChanges();
            
            spinner.succeed('Changes pushed to remote repository');
            logger.info(`Created branch: ${branchName}`);
            logger.info('Please create a pull request on the repository to merge your changes.');
        } catch (error) {
            logger.error('Failed to sync to remote repository:', error);
        }
    } else {
        logger.info(
            'Changes will be tracked and you can sync them later using "prompt-library-cli sync --push"'
        );
    }
}

// Create command
const createCommand = new Command('create')
    .description('Create a new prompt')
    .option('-d, --directory <name>', 'Directory name for the new prompt (snake_case)')
    .option('--title <title>', 'Title for the new prompt')
    .option('--category <category>', 'Primary category for the prompt')
    .option('--description <description>', 'One-line description for the prompt')
    .option('--no-analyze', 'Skip AI analysis of prompt to generate metadata (uses prompt_analysis_agent)')
    .action(async (options) => {
        try {
            // Create new prompt
            const promptData = await collectInitialMetadata(options);

            // Get prompt content from user
            const promptContent = await collectPromptContent(promptData);
            if (!promptContent || promptContent.trim() === '') {
                logger.error('Prompt content cannot be empty');
                return;
            }

            // Generate metadata using AI if enabled
            if (options.analyze !== false) {
                await analyzeAndGenerateMetadata(promptData, promptContent);
            }

            // Write files to disk
            await savePromptFiles(promptData, promptContent);

            // Update database with just this prompt
            await updateDatabase(promptData.directory);

            // Track the change for syncing later and add to git if enabled
            const { trackPromptChange } = await import('../utils/sync-utils');
            await trackPromptChange(promptData.directory, 'add', promptData.title);
            
            // Stage files in git when using dedicated repository
            const { stagePromptChanges } = await import('../utils/library-repository');
            await stagePromptChanges(promptData.directory);

            logger.info(`Prompt "${promptData.title}" successfully created`);
            logger.info(`Located at: ${path.join(getConfig().PROMPTS_DIR, promptData.directory)}`);

            // Offer to sync to remote if user wants
            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to create prompt:', error);
        }
    });

// Edit command
const editCommand = new Command('edit')
    .description('Edit an existing prompt')
    .option('-p, --prompt <promptId>', 'ID or directory name of the prompt to edit')
    .argument('[promptId]', 'ID or directory name of the prompt to edit')
    .option('--no-analyze', 'Skip AI analysis of prompt to generate metadata (uses prompt_analysis_agent)')
    .action(async (promptId, options) => {
        try {
            // Get promptId from argument or option
            const promptIdentifier = promptId || options.prompt;
            let promptToEdit = promptIdentifier;
            
            if (!promptIdentifier) {
                // If no promptId provided, list prompts and ask user to select one
                const { selectPrompt } = await import('../utils/prompts');
                const selectedPrompt = await selectPrompt();
                if (!selectedPrompt) {
                    logger.error('No prompt selected. Exiting.');
                    return;
                }
                promptToEdit = selectedPrompt.id.toString();
            }
            
            // Edit existing prompt
            const promptData = await loadPromptForEditing(promptToEdit);
            if (!promptData) {
                return;
            }

            // Get prompt content from user
            const promptContent = await collectPromptContent(promptData);
            if (!promptContent || promptContent.trim() === '') {
                logger.error('Prompt content cannot be empty');
                return;
            }

            // Generate metadata using AI if enabled
            if (options.analyze !== false) {
                await analyzeAndGenerateMetadata(promptData, promptContent);
            }

            // Write files to disk
            await savePromptFiles(promptData, promptContent);

            // Update database with just this prompt
            await updateDatabase(promptData.directory);

            // Track the change for syncing later
            const { trackPromptChange } = await import('../utils/sync-utils');
            await trackPromptChange(promptData.directory, 'modify', promptData.title);
            
            // Stage files in git when using dedicated repository
            const { stagePromptChanges } = await import('../utils/library-repository');
            await stagePromptChanges(promptData.directory);

            logger.info(`Prompt "${promptData.title}" successfully updated`);
            logger.info(`Located at: ${path.join(getConfig().PROMPTS_DIR, promptData.directory)}`);

            // Offer to sync to remote if user wants
            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to edit prompt:', error);
        }
    });

export { createCommand, editCommand };