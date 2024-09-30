import os
import yaml
import logging
from jinja2 import Environment, FileSystemLoader

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def format_category(category):
    """Format the category string to be well-formatted."""
    return ' '.join(word.capitalize() for word in category.replace('_', ' ').split())

def update_views():
    """
    Update view files for all prompts and generate a new README.md file.
    """
    logger.info("Starting update_views process")
    prompts_dir = 'prompts'
    categories = {}

    # Set up Jinja2 environment for templating
    logger.info("Setting up Jinja2 environment")
    env = Environment(loader=FileSystemLoader('.github/templates'))
    view_template = env.get_template('view_template.md')
    readme_template = env.get_template('readme_template.md')
    logger.info("Jinja2 templates loaded")

    # Iterate through all prompt directories
    logger.info(f"Iterating through prompts in {prompts_dir}")
    for prompt_dir in os.listdir(prompts_dir):
        prompt_path = os.path.join(prompts_dir, prompt_dir)
        if os.path.isdir(prompt_path):
            logger.info(f"Processing prompt directory: {prompt_dir}")

            # Read prompt content and metadata
            prompt_file = os.path.join(prompt_path, 'prompt.md')
            metadata_file = os.path.join(prompt_path, 'metadata.yml')

            if not os.path.exists(prompt_file):
                logger.warning(f"prompt.md not found in {prompt_dir}")
                continue
            if not os.path.exists(metadata_file):
                logger.warning(f"metadata.yml not found in {prompt_dir}")
                continue

            with open(prompt_file, 'r') as f:
                prompt_content = f.read()
            logger.info(f"Read prompt content from {prompt_file}")

            with open(metadata_file, 'r') as f:
                metadata = yaml.safe_load(f)
            logger.info(f"Read metadata from {metadata_file}")

            # Generate view content using the template
            view_content = view_template.render(
                metadata=metadata,
                prompt_content=prompt_content
            )
            logger.info("Generated view content using template")

            # Write the view content to a file
            view_path = os.path.join(prompt_path, 'view.md')
            with open(view_path, 'w') as f:
                f.write(view_content)
            logger.info(f"Wrote view content to {view_path}")

            # Organize prompts by category for the README
            primary_category = metadata.get('primary_category', 'uncategorized')
            if primary_category not in categories:
                categories[primary_category] = []

            categories[primary_category].append({
                'title': metadata.get('title', 'Untitled'),
                'description': metadata.get('one_line_description', 'No description'),
                'path': f'prompts/{prompt_dir}/view.md',
                'subcategories': metadata.get('subcategories', [])
            })
            logger.info(f"Added prompt to category: {primary_category}")

    # Remove empty categories
    categories = {k: v for k, v in categories.items() if v}

    # Sort categories alphabetically
    sorted_categories = dict(sorted(categories.items()))

    # Generate README content using the template and write to file
    logger.info("Generating README content")
    readme_content = readme_template.render(categories=sorted_categories, format_category=format_category)
    readme_path = 'README.md'
    with open(readme_path, 'w') as f:
        f.write(readme_content)
    logger.info(f"Wrote README content to {readme_path}")

    logger.info("update_views process completed")

if __name__ == '__main__':
    logger.info("Script started")
    try:
        update_views()
        logger.info("Script completed successfully")
    except Exception as e:
        logger.exception(f"An error occurred: {str(e)}")
        raise