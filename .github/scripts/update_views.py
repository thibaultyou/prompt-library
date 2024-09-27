import os
import yaml
from jinja2 import Environment, FileSystemLoader

def format_category_name(category):
    words = category.split('_')
    return ' '.join(word.capitalize() for word in words)

def update_views():
    prompts_dir = 'prompts'
    categories = {}

    env = Environment(loader=FileSystemLoader('.github/templates'))
    view_template = env.get_template('view_template.md')
    readme_template = env.get_template('readme_template.md')

    for category in os.listdir(prompts_dir):
        category_path = os.path.join(prompts_dir, category)
        if os.path.isdir(category_path):
            formatted_category = format_category_name(category)
            categories[formatted_category] = []
            for prompt_dir in os.listdir(category_path):
                prompt_path = os.path.join(category_path, prompt_dir)
                if os.path.isdir(prompt_path):
                    with open(os.path.join(prompt_path, 'prompt.md'), 'r') as f:
                        prompt_content = f.read()
                    with open(os.path.join(prompt_path, 'metadata.yml'), 'r') as f:
                        metadata = yaml.safe_load(f)
                    
                    view_content = view_template.render(
                        metadata=metadata,
                        prompt_content=prompt_content
                    )
                    
                    view_path = os.path.join(prompt_path, 'view.md')
                    with open(view_path, 'w') as f:
                        f.write(view_content)
                    
                    categories[formatted_category].append({
                        'name': prompt_dir,
                        'description': metadata['one_line_description'],
                        'path': f'prompts/{category}/{prompt_dir}/view.md'
                    })

    # Update README
    readme_content = readme_template.render(categories=categories)
    with open('README.md', 'w') as f:
        f.write(readme_content)

if __name__ == '__main__':
    update_views()