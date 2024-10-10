# 🧠 Prompt Library

> ### 🚧 **Project Under Development** 🚧
> 
> This project is evolving. You may encounter bugs or frequent changes. Feedback and contributions are welcome!

Welcome to the **Prompt Library**, a collection of categorized AI prompts for easy navigation and reuse. Fork and customize this repository to build your own personalized prompt library tailored to your needs.

## 📚 Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [🎯 Purpose](#-purpose)
- [🛠️ How It Works](#-how-it-works)
- [📂 Prompt Library Example](#-prompt-library-example)
- [🚀 Getting Started](#-getting-started)
- [🔧 Customizing Metadata Extraction](#-customizing-metadata-extraction)
- [🧩 Using Fragments](#-using-fragments)
- [📝 Contributing](#-contributing)
- [📄 License](#-license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 🎯 Purpose

This project provides a structured framework for organizing and managing AI prompts, helping you to:

1. Store and categorize your prompts efficiently
2. Automatically generate metadata for your prompts
3. Easily navigate and reuse your prompt collection
4. Collaborate and share prompts with others
5. Create modular and reusable prompt components using fragments

## 🛠️ How It Works

User input and automated processes manage your prompt library:

1. **Add Prompts**: Create `prompt.md` files in the `prompts` directory.
2. **Commit Changes**: Push your changes to the repository.
3. **Automation**: GitHub Actions:
   - Generate metadata using `generate_metadata.ts` and the Anthropic API.
   - Update `README.md` files using `update_views.ts`.
4. **Update Repository**: Changes are automatically committed back.

Monitor these processes in the "Actions" tab of your GitHub repository.

## 📂 Prompt Library Example

> **Note:** The prompts listed here are examples to demonstrate structure and organization. Customize and maintain your own prompts as needed.

> **Tip:** Check out the Prompt Engineering category for prompts to help you create high-quality prompts and build your own library.
<details open>
<summary><strong>Coding</strong></summary>

- [Code Refactoring Agent](prompts/code_refactoring_agent/README.md) - Analyzes, refactors, and validates code to enhance quality, readability, and performance
- [Coding Assistant Agent](prompts/coding_assistant_agent/README.md) - Assists in all aspects of software development across multiple programming languages
- [Git Branch Name Generator](prompts/git_branch_name_generator/README.md) - Generates optimal git branch names based on project context and development requirements
- [Git Commit Message Expert](prompts/git_commit_message_agent/README.md) - Generates precise git commit messages following Conventional Commits specification
- [GitHub Issue Management Agent](prompts/github_issue_management_agent/README.md) - Creates comprehensive, optimized GitHub issues based on project context and team dynamics
- [Software Development Pull Request Generator](prompts/software_dev_pr_generator/README.md) - Generates comprehensive pull requests for software projects based on given context
- [Software Specification Creator](prompts/software_spec_creator_agent/README.md) - Creates detailed software specification documents through interactive requirement analysis

</details>
<details open>
<summary><strong>Healthcare</strong></summary>

- [Health Optimization Agent](prompts/health_optimization_agent/README.md) - Generates personalized, evidence-based health optimization plans using comprehensive data analysis

</details>
<details open>
<summary><strong>Problem Solving</strong></summary>

- [Problem Solving Goal Achievement Agent](prompts/problem_solving_goal_agent/README.md) - Generates tailored expert networks and solutions for complex challenges and ambitious goals

</details>
<details open>
<summary><strong>Prompt Engineering</strong></summary>

- [AI Assistant Architect](prompts/ai_assistant_architect/README.md) - Generates innovative and practical concepts for specialized AI assistants
- [Prompt Engineering God](prompts/prompt_engineering_agent/README.md) - Crafts and refines optimized prompts for AI models using advanced techniques and guidelines

</details>
<details open>
<summary><strong>Translation</strong></summary>

- [Universal Translator Agent](prompts/universal_translator_agent/README.md) - Translates between any languages, modes of expression, or conceptual frameworks

</details>
<details open>
<summary><strong>Writing</strong></summary>

- [Software Documentation Specialist Agent](prompts/software_documentation_agent/README.md) - Creates comprehensive software documentation across various types and industries

</details>

## 🚀 Getting Started

1. **Fork the Repository**: Click "Fork" to create a copy in your GitHub account.
2. **Clone Your Fork**:
   ```
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   ```
3. **Set Up Anthropic API Key**:
   - In repository settings: **Secrets and variables** > **Actions**.
   - Create a secret named `ANTHROPIC_API_KEY` with your API key.
4. **Install Dependencies**:
   - Ensure Node.js (v22+ recommended) is installed.
   - Run `npm install`.
5. **Add Prompts**:
   - Create a `prompt.md` file in the `prompts` directory.
   - Write your prompt content.
   - Commit and push:
     ```
     git add .
     git commit -m "Add new prompt: [Brief Description]"
     git push
     ```
6. **Automated Processes**: GitHub Actions will generate metadata and update README files.
7. **Run Locally (Optional)**:
   - Copy `.env.example` to `.env`:
     ```
     cp .env.example .env
     ```
   - Update `.env` with your API key.
   - Generate metadata:
     ```
     npm run generate-metadata
     ```
   - Update README files:
     ```
     npm run update-views
     ```
8. **Customize as Needed**:
   - Modify templates in `src/templates` to change prompt display.
   - Update scripts in `src/core` to alter metadata generation or view updates.

## 🔧 Customizing Metadata Extraction

The system prompt for metadata extraction is at:

[`src/system_prompts/prompt_analysis_agent/prompt.md`](src/system_prompts/prompt_analysis_agent/prompt.md)

To customize:

1. Open `prompt.md` and modify sections like `<instructions>` or `<output>` to adjust metadata extraction.
2. Save your changes.
3. Run `npm run generate-metadata` to test.
4. Commit and push changes to trigger GitHub Actions.

> **Note**: Changes affect future metadata generations. Test thoroughly.

## 🧩 Using Fragments

Fragments are reusable prompt components.

To use fragments:

1. **Create a Fragment**:
   - In `fragments`, create a subdirectory under the appropriate category.
   - Create a new `.md` file with your fragment content.
2. **Add Fragment to a Prompt**:
   - Include the fragment content in your prompt file.
3. **Update Metadata and Views**:
   - Regenerate metadata:
     ```
     FORCE_REGENERATE=true npm run generate-metadata
     ```
   - Update views:
     ```
     npm run update-views
     ```
4. **Selective Updates**:
   - Manually edit metadata files if needed.
   - Run `npm run update-views` to reflect changes.

> **Note**: Forcing metadata regeneration can be costly; consider running selectively.

## 📝 Contributing

Contributions to improve templates, scripts, or structure are welcome! Submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
