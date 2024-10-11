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

- [Git Commit Message Generator](prompts/git_commit_message_agent/README.md) - Generates precise git commit messages following Conventional Commits specification
- [Git Branch Name Generator](prompts/git_branch_name_generator/README.md) - Generates optimized git branch names based on project context and best practices
- [GitHub Issue Creator Agent](prompts/github_issue_creator_agent/README.md) - Creates comprehensive and actionable GitHub issues based on provided project context
- [Software Architect Code Reviewer](prompts/software_architect_code_reviewer/README.md) - Generates comprehensive pull requests with architectural insights and optimization proposals
- [Software Development Expert Agent](prompts/software_development_agent/README.md) - Provides expert assistance across all aspects of the software development lifecycle.

</details>
<details open>
<summary><strong>Healthcare</strong></summary>

- [Health Optimization Agent](prompts/health_optimization_agent/README.md) - Generates personalized, adaptive health optimization plans based on comprehensive user data analysis
- [Psychological Support Therapy Assistant](prompts/psych_support_therapy_agent/README.md) - Provides personalized, AI-driven psychological support and therapy through digital platforms

</details>
<details open>
<summary><strong>Problem Solving</strong></summary>

- [Problem Solving AI Agent](prompts/problem_solving_ai_agent/README.md) - Generates expert networks and strategies to solve complex problems and achieve ambitious goals

</details>
<details open>
<summary><strong>Prompt Engineering</strong></summary>

- [AI Assistant Concept Architect](prompts/ai_assistant_concept_architect/README.md) - Generates innovative and feasible AI assistant concepts based on user-provided topics
- [Advanced Documentation Specialist Agent](prompts/documentation_specialist_agent/README.md) - Generates revolutionary software documentation using advanced AI techniques
- [Prompt Engineering God](prompts/prompt_engineering_agent/README.md) - Creates optimized prompts to maximize AI potential while adhering to ethical standards
- [Software Engineering Architect Agent](prompts/software_engineering_architect/README.md) - Analyzes user requirements and creates comprehensive software specification documents

</details>
<details open>
<summary><strong>Translation</strong></summary>

- [Omniscient Translation Agent](prompts/omniscient_translation_agent/README.md) - Translates between any conceivable forms of expression or existence across all realities

</details>

## 🚀 Getting Started

1. **Fork the Repository**: Click "Fork" to create a copy in your GitHub account.
2. **Clone Your Fork**:
   ```
   git clone https://github.com/YOUR_USERNAME/prompt-library.git
   ```
3. **Set Up Anthropic API Key**:
   - In repository settings: **Secrets and variables** > **Actions**.
   - Create a secret named `ANTHROPIC_API_KEY` with your API key.
4. **Install Dependencies**:
   - Ensure Node.js (v22+ recommended) is installed.
   - Navigate to the directory:
      ```
      cd prompt-library
      ```
   - Install dependencies:
     ```
     npm install
     ```
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

1. Navigate to the directory:
   ```
   cd src/system_prompts/prompt_analysis_agent
   ```

2. Edit the system prompt:
   ```
   nano prompt.md
   ```
   Modify `<instructions>` or `<output>` sections as needed.

3. Test changes:
   ```
   cd ../../../
   npm run generate-metadata
   ```

4. Commit and push:
   ```
   git add src/system_prompts/prompt_analysis_agent/prompt.md
   git commit -m "Update metadata extraction"
   git push
   ```

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
