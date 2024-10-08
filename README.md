# 📚 Prompt Library

> ### 🚧 **Project Under Development** 🚧
> 
> This project is evolving. You may encounter bugs or frequent changes. Your feedback and contributions are welcome!

Welcome to the **Prompt Library**. This repository contains a collection of AI prompts categorized for easy navigation and reuse.

## 📂 Categories

> **Note:** The prompts listed here serve as examples to demonstrate the structure and organization of this library. The primary goal is for you, the user, to create and maintain your own personalized library of prompts tailored to your specific needs and use cases. Feel free to modify, remove, or add prompts as you see fit.

> **Tip:** Check out the Prompt Engineering category in this library. It contains prompts that can help you create high-quality prompts with ease and get started in building your own prompt library.

### Coding

- [Coding Assistant Agent](prompts/coding_assistant_agent/README.md) - Assists with code writing, analysis, optimization, and debugging across multiple languages
- [Code Refactoring Agent](prompts/code_refactoring_agent/README.md) - Analyzes, refactors, and validates code to improve quality, readability, and performance
- [Git Branch Name Generator](prompts/git_branch_name_generator/README.md) - Generates optimal git branch names based on project context and development workflow
- [Git Commit Message Expert](prompts/git_commit_message_agent/README.md) - Generates precise git commit messages following Conventional Commits specification
- [GitHub Issue Creator Agent](prompts/github_issue_creator_agent/README.md) - Creates comprehensive, optimized GitHub issues based on project context and team dynamics
- [Software Developer Pull Request Generator](prompts/software_dev_pr_generator/README.md) - Generates comprehensive pull requests for software development projects
- [Software Specification Agent](prompts/software_specification_agent/README.md) - Generates comprehensive software specifications through interactive requirements gathering

### Healthcare

- [Health Optimization Agent](prompts/health_optimization_agent/README.md) - Generates personalized, evidence-based wellness plans using comprehensive health data analysis

### Problem Solving

- [Problem Solving Network Agent](prompts/problem_solving_network_agent/README.md) - Generates tailored expert networks and solutions for complex challenges and goal achievement

### Prompt Engineering

- [AI Assistant Concept Creator](prompts/ai_assistant_concept_creator/README.md) - Generates innovative and feasible concepts for specialized AI assistants
- [Prompt Engineering Agent](prompts/prompt_engineering_agent/README.md) - Creates and refines optimized AI prompts tailored to specific user requirements and models

### Translation

- [Universal Translator Agent](prompts/universal_translator_agent/README.md) - Translates between any languages, concepts, or modes of expression across all dimensions

### Writing

- [Software Documentation Specialist Agent](prompts/software_documentation_agent/README.md) - Creates comprehensive software documentation across various types and platforms

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
   - Install dependencies by running `npm install` in the root directory of your project.
   - Copy the `.env.example` file to a new file named `.env` in the root directory of your project:
     ```
     cp .env.example .env
     ```
   - Open the `.env` file and update the environment variables:
     ```
     ANTHROPIC_API_KEY=your_actual_api_key_here
     FORCE_REGENERATE=false
     LOG_LEVEL=info
     ```
     - Replace `your_actual_api_key_here` with your Anthropic API key.
     - Set `FORCE_REGENERATE` to `true` if you want to force regeneration of metadata for all prompts.
     - Adjust `LOG_LEVEL` as needed (`debug`, `info`, `warn`, or `error`).
   - Ensure that `.env` is listed in your `.gitignore` file to prevent committing sensitive information.
   - To generate metadata for your prompts, run:
     ```
     npm run generate-metadata
     ```
   - To update the README files, run:
     ```
     npm run update-views
     ```

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
   - Adapt the categories in the `Top-Level Categories` list to better suit your needs.
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
