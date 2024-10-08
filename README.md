# 📚 Prompt Library

> ### 🚧 **Project Under Active Development** 🚧
> 
> **Note:** This project is new and undergoing rapid development. You may encounter bugs or frequent changes. We appreciate your patience and encourage you to:
> - Report any issues you encounter
> - Check for updates regularly
> - Contribute ideas or improvements
> 
> Your feedback is valuable in shaping this project. Thank you for your interest and support!

Welcome to the **Prompt Library**. This repository contains a collection of AI prompts categorized for easy navigation and reuse.

## 🗂️ Categories

### Artificial Intelligence And Machine Learning

- [AI Concept Creator](prompts/ai_concept_agent/README.md) - Generates innovative and feasible concepts for specialized AI assistants

### Code Quality And Best Practices

- [Elite AI Coding Assistant](prompts/coding_assistant_agent/README.md) - Assists in all aspects of software development with expert-level guidance
- [Divine Code Refactoring Agent](prompts/code_refactoring_agent/README.md) - Analyzes, refactors, and validates code to improve quality, readability, and performance
- [Software Development Pull Request Generator](prompts/software_dev_pr_agent/README.md) - Generates comprehensive pull requests for software projects based on given context

### Project Management

- [GitHub Issue Creation Expert](prompts/github_issue_agent/README.md) - Creates comprehensive, actionable GitHub issues based on project context and team dynamics
- [Software Specification Creator](prompts/software_spec_agent/README.md) - Generates comprehensive software specifications through interactive requirements gathering

### Prompt Engineering

- [Divine-Tier Prompt Engineering](prompts/prompt_engineering_agent/README.md) - Creates or refines optimized prompts for AI models across diverse domains

### Version Control

- [Git Commit Message Generator](prompts/git_commit_message_agent/README.md) - Generates precise git commit messages following Conventional Commits specification
- [Git Branch Name Generator](prompts/git_branch_name_agent/README.md) - Generates optimal git branch names based on project context and development requirements

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

4. **Install Dependencies**:
   - Ensure you have Node.js installed (version 22 or later recommended).
   - Run `npm install` to install the project dependencies.

5. **Add Your Own Prompts**:
   - Create a new file in the `prompts` directory named `prompt.md`.
   - Write your prompt content in this file.
   - Commit and push your changes to GitHub.

6. **Let GitHub Actions Work**:
   - The GitHub Actions workflow will automatically generate metadata for your new prompt.
   - It will create a new directory for your prompt, move the `prompt.md` file into it, and create `metadata.yml` and `README.md` files.
   - The main README will be automatically updated to include your new prompt.

7. **Run Locally**:
   - Use `npm run generate-metadata` to generate metadata for your prompts.
   - Use `npm run update-views` to update the README files.

8. **Customize as Needed**:
   - Modify the templates in the `src/templates` directory to change how prompts are displayed.
   - Update the scripts in `src/core` to alter the metadata generation or view update process.

## 🛠️ How It Works

- When you add or update a `prompt.md` file in the `prompts` directory, GitHub Actions are triggered.
- The `generate_metadata.ts` script uses the Anthropic API to analyze your prompt and generate metadata.
- The `update_views.ts` script creates or updates the `README.md` files for each prompt and updates the main README.
- All changes are automatically committed back to the repository.

## 🔧 Customizing Metadata Extraction

The system prompt used to extract metadata from your prompts can be customized. This prompt is located at:

[`src/system_prompts/prompt_analysis_agent/prompt.md`](src/system_prompts/prompt_analysis_agent/prompt.md)

To customize the metadata extraction process:

1. Open the `prompt.md` file in your preferred text editor.
2. Review the existing prompt structure, which includes sections like `<system_role>`, `<task>`, `<input_parameters>`, `<instructions>`, and `<output>`.
3. Modify the content within these sections to adjust the behavior of the metadata extraction process. For example:
   - Update the `<instructions>` section to change how categories are assigned.
   - Modify the `<output>` section to alter the structure of the generated metadata.
4. Save your changes to the file.

After modifying the prompt:

- Run `npm run generate-metadata` locally to test your changes.
- Review the generated metadata files to ensure the output meets your expectations.
- If satisfied, commit and push your changes to trigger the GitHub Actions workflow.

This customization allows you to tailor the metadata generation process to your specific needs or to extract additional information from your prompts. Remember that changes to this file will affect all future metadata generations, so test thoroughly before committing.

> **Note**: The `generate_metadata.ts` script in `src/core/` uses this prompt file when interacting with the Anthropic API. If you make significant changes to the prompt structure, you may need to update the script as well.

## 📝 Contributing

Contributions to improve the templates, scripts, or overall structure of this prompt library are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
