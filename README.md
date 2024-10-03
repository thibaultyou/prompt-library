# 📚 Prompt Library

Welcome to the **Prompt Library**. This repository contains a collection of AI prompts categorized for easy navigation and reuse.

## 🗂️ Categories
### Artificial Intelligence And Machine Learning
- [AI Concept Generator for Specialized Assistants](prompts/ai_concept_generator_specialized_assistants/view.md) - Generates innovative and feasible AI assistant concepts for specific topics
### Code Quality And Best Practices
- [Software Development Pull Request Generator](prompts/software_development_pull_request_generator/view.md) - Generates comprehensive pull requests for software development projects
- [Divine Code Refactoring and Optimization](prompts/divine_code_refactoring_and_optimization/view.md) - Analyzes, refactors, and optimizes code with divine precision and engineering best practices
- [Elite AI Coding Assistant](prompts/elite_ai_coding_assistant/view.md) - Assists in all aspects of software development with advanced expertise
### Documentation
- [Software Specification Creator](prompts/software_specification_creator/view.md) - Creates detailed software specification documents through interactive requirement gathering
### Project Management
- [GitHub Issue Creation by Divine Engineer](prompts/github_issue_creation_divine_engineer/view.md) - Creates optimized GitHub issues using deep insights and project context
### Prompt Engineering
- [AI Prompt Engineering God](prompts/ai_prompt_engineering_god/view.md) - Creates and refines optimized prompts for AI models across various domains
### Version Control
- [Git Commit Message Generator](prompts/git_commit_message_generator/view.md) - Generates perfect git commit messages following Conventional Commits specification

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