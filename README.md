# 📚 Prompt Library

Welcome to the **Prompt Library**. This repository contains a collection of AI prompts categorized for easy navigation and reuse.

## 🗂️ Categories



### Code Documentation



- [AI Code Repository Documentation Generator](prompts/ai_code_repository_documentation_generator/view.md) - Analyzes code repositories and generates comprehensive documentation autonomously




### Code Improvement



- [Code Refactoring AI Assistant](prompts/code_refactoring_ai_assistant/view.md) - Analyzes, refactors, and tests code to improve quality, readability, and performance




### Idea Generation



- [God Tier Assistant Generator](prompts/god_tier_assistant_generator/view.md) - Generates innovative ideas for specialized AI assistants based on given topics


- [AI Topic Idea Generator](prompts/ai_topic_idea_generator/view.md) - Generates innovative AI application ideas for specific domains and constraints




### Issue Management



- [GitHub Issue Creator](prompts/github_issue_creator_from_user_input/view.md) - Creates well-structured GitHub Issues from user input and project context




### Product Management



- [Software Specification Generator](prompts/software_specification_generator/view.md) - Creates comprehensive software specifications based on user requirements and interactive review




### Software Development



- [AI Software Development Assistant](prompts/ai_software_development_assistant/view.md) - Provides expert guidance and support throughout the software development lifecycle


- [GitHub Pull Request Generator](prompts/github_pull_request_generator/view.md) - Generates comprehensive and well-structured GitHub pull requests based on change details and project context




### Version Control



- [Git Commit Message Writer](prompts/git_commit_message_writer/view.md) - Generates concise, informative git commit messages with emojis following Conventional Commits




## 🚀 Getting Started

This repository is designed to be easily forked and customized for your own use. Follow these steps to get started:

1. **Fork the Repository**: Click the "Fork" button at the top right of this page to create a copy of this repository in your own GitHub account.

2. **Clone Your Fork**: Clone the forked repository to your local machine using:

   ```
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   ```

3. **Set Up Anthropic API Key**:
   - Go to your repository's settings on GitHub.
   - Navigate to "Secrets and variables" > "Actions".
   - Create a new repository secret named `ANTHROPIC_API_KEY` and paste your Anthropic API key as the value.

4. **Add Your Own Prompts**:
   - Create a new file in the `prompts` directory named `prompt.md`.
   - Write your prompt content in this file.
   - Commit and push your changes to GitHub.

5. **Let GitHub Actions Work**:
   - The GitHub Actions workflow will automatically generate metadata for your new prompt.
   - It will create a new directory for your prompt, move the `prompt.md` file into it, and create `metadata.yml` and `view.md` files.
   - The README will be automatically updated to include your new prompt.

6. **Customize as Needed**:
   - You can modify the templates in the `.github/templates` directory to change how prompts are displayed.
   - Update the scripts in `.github/scripts` to alter the metadata generation or view update process.

## 🛠️ How It Works

- When you add or update a `prompt.md` file in the `prompts` directory, GitHub Actions are triggered.
- The `generate_metadata.py` script uses the Anthropic API to analyze your prompt and generate metadata.
- The `update_views.py` script creates or updates the `view.md` files for each prompt and updates the main README.
- All changes are automatically committed back to the repository.

## 🔧 Customizing Metadata Extraction

The system prompt used to extract metadata from your prompts can be customized. This prompt is located at:

```
.github/prompts/ai_prompt_analyzer_and_output_generator/prompt.md
```

You can modify this file to change how metadata is extracted from your prompts. This allows you to tailor the metadata generation process to your specific needs or to extract additional information from your prompts.

## 📝 Contributing

Contributions to improve the templates, scripts, or overall structure of this prompt library are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.