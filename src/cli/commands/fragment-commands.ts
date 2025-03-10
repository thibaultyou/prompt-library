import path from 'path';

import { select, confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import fs from 'fs-extra';

import { PromptFragment } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { cliConfig } from '../config/cli-config';
import { selectFragmentForEditing } from '../utils/fragments';
import { stagePromptChanges } from '../utils/library-repository';
import { editInEditor } from '../utils/prompts-simple';
import { clearPendingChanges, createBranchAndPushChanges, trackPromptChange } from '../utils/sync-utils';
import { getInput, showSpinner } from '../utils/ui-components';

async function collectFragmentData(options: any): Promise<PromptFragment> {
    let category = options.category;

    if (!category) {
        category = await selectFragmentCategory();
    }

    let name = options.name;

    if (!name) {
        name = await getInput('Enter fragment name (snake_case):');
        name = name
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }
    return {
        category,
        name
    };
}

async function selectFragmentCategory(): Promise<string> {
    try {
        const dirExists = await fs.pathExists(cliConfig.FRAGMENTS_DIR);

        if (!dirExists) {
            await fs.ensureDir(cliConfig.FRAGMENTS_DIR);
            logger.info('Created fragments directory');
        }

        const categories = await fs.readdir(cliConfig.FRAGMENTS_DIR);
        const choices = [
            { name: '+ Create new category', value: '_new_category_' },
            ...categories.map((c) => ({ name: c, value: c }))
        ];
        const category = await select({
            message: 'Select a category:',
            choices
        });

        if (category === '_new_category_') {
            const newCategory = await getInput('Enter new category name (snake_case):');
            const formattedCategory = newCategory
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, formattedCategory);
            await fs.ensureDir(categoryPath);
            logger.info(`Created new category: ${formattedCategory}`);
            return formattedCategory;
        }
        return category;
    } catch (error) {
        logger.error('Error selecting fragment category:', error);
        throw error;
    }
}

async function collectFragmentContent(fragment: PromptFragment): Promise<string> {
    let content = '';
    const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, fragment.category, `${fragment.name}.md`);

    if (await fs.pathExists(fragmentPath)) {
        content = await fs.readFile(fragmentPath, 'utf8');
        logger.info('Current fragment content loaded. Opening in editor...');

        const newContent = await editInEditor(content, {
            message: 'Edit the fragment content (it will open in your default editor):',
            postfix: '.md'
        });
        return newContent || content;
    } else {
        logger.info('Opening editor for new fragment content...');

        const templateContent = `# ${fragment.name}

Enter your fragment content here. This fragment can be included in prompts.

## Usage
This fragment is part of the ${fragment.category} category.
`;
        const newContent = await editInEditor(templateContent, {
            message: 'Create your fragment content (it will open in your default editor):',
            postfix: '.md'
        });
        return newContent || '';
    }
}

async function saveFragmentContent(fragment: PromptFragment, content: string): Promise<void> {
    try {
        const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, fragment.category);
        await fs.ensureDir(categoryPath);

        const fragmentPath = path.join(categoryPath, `${fragment.name}.md`);
        await fs.writeFile(fragmentPath, content);

        logger.info(`Fragment ${fragment.category}/${fragment.name} saved successfully`);
    } catch (error) {
        logger.error('Failed to save fragment:', error);
        throw error;
    }
}

async function offerRemoteSync(): Promise<void> {
    const doSync = await confirm({
        message: 'Would you like to sync this fragment to the remote repository now?',
        default: false
    });

    if (doSync) {
        try {
            const spinner = showSpinner('Syncing to remote repository...');
            const branchName = `fragment/${Date.now()}`;
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

async function loadFragmentForEditing(category: string, name: string): Promise<PromptFragment | null> {
    try {
        const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, category, `${name}.md`);

        if (!(await fs.pathExists(fragmentPath))) {
            logger.error(`Fragment ${category}/${name} not found`);
            return null;
        }
        return { category, name };
    } catch (error) {
        logger.error('Failed to load fragment for editing:', error);
        return null;
    }
}

const createCommand = new Command('create')
    .description('Create a new fragment')
    .option('-c, --category <category>', 'Category for the new fragment')
    .option('-n, --name <name>', 'Name for the new fragment (snake_case)')
    .action(async (options) => {
        // For direct argv parsing as a fallback
        const categoryIndex = process.argv.indexOf('-c') !== -1 ? process.argv.indexOf('-c') : process.argv.indexOf('--category');
        const nameIndex = process.argv.indexOf('-n') !== -1 ? process.argv.indexOf('-n') : process.argv.indexOf('--name');
        
        if (categoryIndex !== -1 && categoryIndex < process.argv.length - 1 && !options.category) {
            options.category = process.argv[categoryIndex + 1];
        }
        
        if (nameIndex !== -1 && nameIndex < process.argv.length - 1 && !options.name) {
            options.name = process.argv[nameIndex + 1];
        }

        try {
            const fragmentData = await collectFragmentData(options);
            const fragmentContent = await collectFragmentContent(fragmentData);

            if (!fragmentContent || fragmentContent.trim() === '') {
                logger.error('Fragment content cannot be empty');
                return;
            }

            await saveFragmentContent(fragmentData, fragmentContent);

            await trackPromptChange(`fragments/${fragmentData.category}/${fragmentData.name}`, 'add', 'fragment');

            await stagePromptChanges(`fragments/${fragmentData.category}`);

            logger.info(`Fragment ${fragmentData.category}/${fragmentData.name} successfully created`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to create fragment:', error);
        }
    });
const editCommand = new Command('edit')
    .description('Edit an existing fragment')
    .option('-c, --category <category>', 'Category of the fragment to edit')
    .option('-n, --name <name>', 'Name of the fragment to edit')
    .action(async (options) => {
        // For direct argv parsing as a fallback
        const categoryIndex = process.argv.indexOf('-c') !== -1 ? process.argv.indexOf('-c') : process.argv.indexOf('--category');
        const nameIndex = process.argv.indexOf('-n') !== -1 ? process.argv.indexOf('-n') : process.argv.indexOf('--name');
        
        if (categoryIndex !== -1 && categoryIndex < process.argv.length - 1 && !options.category) {
            options.category = process.argv[categoryIndex + 1];
        }
        
        if (nameIndex !== -1 && nameIndex < process.argv.length - 1 && !options.name) {
            options.name = process.argv[nameIndex + 1];
        }

        try {
            let category = options.category;
            let name = options.name;

            if (!category || !name) {
                const selectedFragment = await selectFragmentForEditing();

                if (!selectedFragment) {
                    logger.error('No fragment selected. Exiting.');
                    return;
                }

                category = selectedFragment.category;
                name = selectedFragment.name;
            }

            const fragmentData = await loadFragmentForEditing(category, name);

            if (!fragmentData) {
                return;
            }

            const fragmentContent = await collectFragmentContent(fragmentData);

            if (!fragmentContent || fragmentContent.trim() === '') {
                logger.error('Fragment content cannot be empty');
                return;
            }

            await saveFragmentContent(fragmentData, fragmentContent);

            await trackPromptChange(`fragments/${fragmentData.category}/${fragmentData.name}`, 'modify', 'fragment');
            await stagePromptChanges(`fragments/${fragmentData.category}`);

            logger.info(`Fragment ${fragmentData.category}/${fragmentData.name} successfully updated`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to edit fragment:', error);
        }
    });
const deleteCommand = new Command('delete')
    .description('Delete an existing fragment')
    .option('-c, --category <category>', 'Category of the fragment to delete')
    .option('-n, --name <name>', 'Name of the fragment to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
        // For direct argv parsing as a fallback
        const categoryIndex = process.argv.indexOf('-c') !== -1 ? process.argv.indexOf('-c') : process.argv.indexOf('--category');
        const nameIndex = process.argv.indexOf('-n') !== -1 ? process.argv.indexOf('-n') : process.argv.indexOf('--name');
        const forceFlag = process.argv.includes('-f') || process.argv.includes('--force');
        
        if (categoryIndex !== -1 && categoryIndex < process.argv.length - 1 && !options.category) {
            options.category = process.argv[categoryIndex + 1];
        }
        
        if (nameIndex !== -1 && nameIndex < process.argv.length - 1 && !options.name) {
            options.name = process.argv[nameIndex + 1];
        }
        
        if (forceFlag && !options.force) {
            options.force = true;
        }

        try {
            let category = options.category;
            let name = options.name;

            if (!category || !name) {
                const selectedFragment = await selectFragmentForEditing();

                if (!selectedFragment) {
                    logger.error('No fragment selected. Exiting.');
                    return;
                }

                category = selectedFragment.category;
                name = selectedFragment.name;
            }

            const fragmentData = await loadFragmentForEditing(category, name);

            if (!fragmentData) {
                return;
            }

            if (!options.force) {
                const shouldDelete = await confirm({
                    message: `Are you sure you want to delete the fragment ${fragmentData.category}/${fragmentData.name}? This cannot be undone.`,
                    default: false
                });

                if (!shouldDelete) {
                    logger.info('Deletion cancelled.');
                    return;
                }
            }

            const fragmentPath = path.join(cliConfig.FRAGMENTS_DIR, fragmentData.category, `${fragmentData.name}.md`);
            await fs.remove(fragmentPath);

            await trackPromptChange(`fragments/${fragmentData.category}/${fragmentData.name}`, 'delete', 'fragment');

            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, fragmentData.category);

            try {
                const remainingFiles = await fs.readdir(categoryPath);

                if (remainingFiles.length === 0) {
                    await fs.remove(categoryPath);
                    logger.info(`Removed empty category directory: ${fragmentData.category}`);

                    await trackPromptChange(`fragments/${fragmentData.category}`, 'delete', 'fragment category');
                }
            } catch (error) {
                logger.warn(`Could not check if category is empty: ${error}`);
            }

            await stagePromptChanges(`fragments/${fragmentData.category}`);

            logger.info(`Fragment ${fragmentData.category}/${fragmentData.name} successfully deleted`);

            await offerRemoteSync();
        } catch (error) {
            logger.error('Failed to delete fragment:', error);
        }
    });

export { createCommand, deleteCommand, editCommand };
