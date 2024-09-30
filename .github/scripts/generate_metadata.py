import hashlib
import logging
import os
import shutil
import yaml
from anthropic import Anthropic

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to the analyzer prompt file
ANALYZER_PROMPT_PATH = '.github/prompts/ai_prompt_analyzer_and_output_generator/prompt.md'

def load_analyzer_prompt():
    """Load the content of the analyzer prompt file."""
    logger.info(f"Loading analyzer prompt from {ANALYZER_PROMPT_PATH}")
    with open(ANALYZER_PROMPT_PATH, 'r') as f:
        content = f.read()
    logger.info(f"Analyzer prompt loaded, length: {len(content)} characters")
    return content

def generate_metadata(prompt_content):
    """Generate metadata for a given prompt content using the Anthropic API."""
    logger.info("Starting metadata generation")
    
    # Check for the presence of the API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY is not set in the environment.")
        raise EnvironmentError("ANTHROPIC_API_KEY is not set in the environment.")
    else:
        logger.info("ANTHROPIC_API_KEY is set.")
    
    # Initialize the Anthropic client
    client = Anthropic(api_key=api_key)
    logger.info("Anthropic client initialized")
    
    # Load the analyzer prompt
    analyzer_prompt = load_analyzer_prompt()
    
    # Create a message using the Anthropic API
    logger.info("Sending request to Anthropic API")
    message = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=2500,
        messages=[
            {
                "role": "user",
                "content": analyzer_prompt.replace("{{PROMPT}}", prompt_content)
            }
        ]
    )
    logger.info("Received response from Anthropic API")
    
    # Log the structure of the response
    logger.info(f"Response structure: {type(message)}")
    logger.info(f"Content structure: {type(message.content)}")
    
    # Extract the YAML content from the AI response
    content = message.content[0].text if isinstance(message.content, list) else message.content
    logger.info(f"Extracted content: {content[:100]}...") # Log first 100 characters
    
    output_start = content.find("<output>")
    output_end = content.find("</output>")
    if output_start != -1 and output_end != -1:
        yaml_content = content[output_start + 8:output_end].strip()
        logger.info(f"Extracted YAML content: {yaml_content[:100]}...") # Log first 100 characters
        metadata = yaml.safe_load(yaml_content)
        logger.info("YAML content parsed successfully")
    else:
        logger.error("Could not find metadata output in AI response")
        raise ValueError("Could not find metadata output in AI response")
    
    logger.info("Metadata generation completed successfully")
    return metadata

def should_update_metadata(prompt_file, metadata_file):
    """Check if metadata should be updated based on content hash or force flag."""
    force_regenerate = os.environ.get('FORCE_REGENERATE', 'false').lower() == 'true'
    
    if force_regenerate:
        logger.info("Forcing metadata regeneration due to system prompt changes.")
        return True, None

    # Generate hash of the prompt file content
    with open(prompt_file, 'rb') as f:
        prompt_content = f.read()
    prompt_hash = hashlib.md5(prompt_content).hexdigest()

    # If metadata file doesn't exist, update is needed
    if not os.path.exists(metadata_file):
        logger.info(f"Metadata file {metadata_file} does not exist. Update needed.")
        return True, prompt_hash

    # Read the stored hash from metadata file
    with open(metadata_file, 'r') as f:
        metadata_content = f.read()
    
    # Extract the stored hash
    stored_hash_line = next((line for line in metadata_content.split('\n') if line.startswith('content_hash:')), None)
    
    if stored_hash_line:
        stored_hash = stored_hash_line.split(':', 1)[1].strip()
        
        # Compare the hashes
        if prompt_hash != stored_hash:
            logger.info(f"Content hash mismatch for {prompt_file}. Update needed.")
            return True, prompt_hash
    else:
        # If no hash found in metadata, update is needed
        logger.info(f"No content hash found in {metadata_file}. Update needed.")
        return True, prompt_hash

    logger.info(f"Content hash match for {prompt_file}. No update needed.")
    return False, prompt_hash

def update_metadata_hash(metadata_file, new_hash):
    """Update or append the content hash in the metadata file."""
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r') as f:
            lines = f.readlines()
        
        # Update or add the hash line
        hash_updated = False
        for i, line in enumerate(lines):
            if line.startswith('content_hash:'):
                lines[i] = f'content_hash: {new_hash}\n'
                hash_updated = True
                break
        
        if not hash_updated:
            lines.append(f'content_hash: {new_hash}\n')
        
        with open(metadata_file, 'w') as f:
            f.writelines(lines)
        logger.info(f"Content hash updated in {metadata_file}")
    else:
        # If metadata file doesn't exist, create it with the hash
        with open(metadata_file, 'w') as f:
            f.write(f'content_hash: {new_hash}\n')
        logger.info(f"New metadata file created with content hash: {metadata_file}")

def update_prompt_metadata():
    """Update metadata for all prompts in the 'prompts' directory."""
    logger.info("Starting update_prompt_metadata process")
    prompts_dir = 'prompts'
    
    # Process the main prompt.md file in the prompts directory
    main_prompt_file = os.path.join(prompts_dir, 'prompt.md')
    if os.path.exists(main_prompt_file):
        logger.info("Processing main prompt.md file")
        with open(main_prompt_file, 'rb') as f:
            prompt_content = f.read()
        metadata = generate_metadata(prompt_content.decode('utf-8'))
        new_dir_name = metadata['directory']
        new_dir_path = os.path.join(prompts_dir, new_dir_name)
        
        # Create new directory and move the prompt file
        logger.info(f"Creating new directory: {new_dir_path}")
        os.makedirs(new_dir_path, exist_ok=True)
        new_prompt_file = os.path.join(new_dir_path, 'prompt.md')
        logger.info(f"Moving {main_prompt_file} to {new_prompt_file}")
        shutil.move(main_prompt_file, new_prompt_file)
        
        # Save metadata
        metadata_path = os.path.join(new_dir_path, 'metadata.yml')
        logger.info(f"Saving metadata to {metadata_path}")
        with open(metadata_path, 'w') as f:
            yaml.dump(metadata, f, sort_keys=False)
        
        # Update content hash
        new_hash = hashlib.md5(prompt_content).hexdigest()
        update_metadata_hash(metadata_path, new_hash)
    
    # Process subdirectories
    for item in os.listdir(prompts_dir):
        item_path = os.path.join(prompts_dir, item)
        
        if os.path.isdir(item_path):
            logger.info(f"Processing directory: {item}")
            prompt_file = os.path.join(item_path, 'prompt.md')
            metadata_file = os.path.join(item_path, 'metadata.yml')
            
            if os.path.exists(prompt_file):
                should_update, new_hash = should_update_metadata(prompt_file, metadata_file)
                if should_update:
                    logger.info(f"Updating metadata for {item}")
                    with open(prompt_file, 'r') as f:
                        prompt_content = f.read()
                    
                    metadata = generate_metadata(prompt_content)
                    new_dir_name = metadata['directory']
                    
                    # Rename directory if necessary
                    if new_dir_name != item:
                        new_dir_path = os.path.join(prompts_dir, new_dir_name)
                        logger.info(f"Renaming directory from {item} to {new_dir_name}")
                        if os.path.exists(new_dir_path):
                            logger.warning(f"Directory {new_dir_name} already exists. Updating contents.")
                            for file in os.listdir(item_path):
                                src = os.path.join(item_path, file)
                                dst = os.path.join(new_dir_path, file)
                                if os.path.isfile(src):
                                    shutil.copy2(src, dst)
                            shutil.rmtree(item_path)
                        else:
                            os.rename(item_path, new_dir_path)
                        item_path = new_dir_path
                    
                    # Save updated metadata
                    metadata_path = os.path.join(item_path, 'metadata.yml')
                    logger.info(f"Saving updated metadata to {metadata_path}")
                    with open(metadata_path, 'w') as f:
                        yaml.dump(metadata, f, sort_keys=False)
                    
                    # Update content hash
                    update_metadata_hash(metadata_path, new_hash)
                else:
                    logger.info(f"Metadata for {item} is up to date")
            else:
                logger.warning(f"No prompt.md file found in {item_path}")
    
    logger.info("update_prompt_metadata process completed")

if __name__ == '__main__':
    logger.info("Script started")
    try:
        update_prompt_metadata()
        logger.info("Script completed successfully")
    except Exception as e:
        logger.exception(f"An error occurred: {str(e)}")
        raise