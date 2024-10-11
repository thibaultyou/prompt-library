# 🧠 Prompt Library

> 🚧 **Project Under Development** - Evolving project, expect changes. Feedback welcome!

Welcome to the **Prompt Library**, a collection of categorized AI prompts for easy navigation and reuse. Fork and customize this repository to build your own personalized prompt library tailored to your needs.

## 📚 Table of Contents

<!-- START doctoc -->
<!-- END doctoc -->

## 🎯 Purpose

This project provides a structured framework for organizing and managing AI prompts, helping you to:

1. Store and categorize your prompts efficiently
2. Automatically generate metadata for your prompts
3. Easily navigate and reuse your prompt collection
4. Collaborate and share prompts with others
5. Create modular and reusable prompt components using fragments

## 🛠️ How It Works

1. **Add Prompts**: Create a `prompt.md` file in the `prompts` directory.
2. **Commit Changes**: Push your changes to the repository.
3. **Automation**: GitHub Actions generate metadata and update README files.
4. **Update Repository**: Changes are automatically committed back.

## 📂 Prompt Library Example

> **Note:** The prompts listed here are examples to demonstrate structure and organization. Customize and maintain your own prompts as needed.

> **Tip:** Check out the Prompt Engineering category for prompts to help you create high-quality prompts and build your own library.
<details open>
<summary><strong>Coding</strong></summary>

- [Git Branch Name Generator](prompts/git_branch_name_generator/README.md) - Generates optimized git branch names based on project context and best practices
- [Git Commit Message Creator](prompts/git_commit_message_agent/README.md) - Generates optimized git commit messages following Conventional Commits specification
- [GitHub Issue Creator Agent](prompts/github_issue_creator_agent/README.md) - Creates comprehensive and actionable GitHub issues based on provided project information
- [Software Architect Code Reviewer](prompts/software_architect_code_reviewer/README.md) - Generates comprehensive pull requests with architectural analysis and optimization suggestions
- [Software Development Expert Agent](prompts/software_development_agent/README.md) - Provides expert assistance across the software development lifecycle

</details>
<details open>
<summary><strong>Content Creation</strong></summary>

- [Documentation Specialist Agent](prompts/documentation_specialist_agent/README.md) - Generates revolutionary software documentation using AI-powered techniques and industry expertise

</details>
<details open>
<summary><strong>Healthcare</strong></summary>

- [Health Optimization Agent](prompts/health_optimization_agent/README.md) - Generates personalized, adaptive health optimization plans based on comprehensive user data analysis
- [Psychological Support Therapy Agent](prompts/psychological_support_agent/README.md) - Provides personalized, AI-driven psychological support and therapy through digital platforms

</details>
<details open>
<summary><strong>Problem Solving</strong></summary>

- [Problem Solving Assistant](prompts/problem_solving_agent/README.md) - Generates expert networks and strategies to solve complex problems and achieve goals

</details>
<details open>
<summary><strong>Prompt Engineering</strong></summary>

- [Prompt Engineering God](prompts/prompt_engineering_agent/README.md) - Creates or refines optimized prompts to maximize AI potential within ethical boundaries
- [AI Assistant Concept Architect](prompts/ai_assistant_concept_architect/README.md) - Generates innovative and feasible AI assistant concepts based on user-provided topics
- [Software Engineering Architect Agent](prompts/software_engineering_architect/README.md) - Generates comprehensive software specification documents with futuristic insights

</details>
<details open>
<summary><strong>Translation</strong></summary>

- [Omniscient Cosmic Translator](prompts/cosmic_translator_agent/README.md) - Translates between all forms of expression and existence across infinite realities

</details>

## 🚀 Getting Started

1. **Fork the Repository**: Click "Fork" to create a copy in your GitHub account.
2. **Clone Your Fork**:
   ```
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   ```
3. **Set Up Anthropic API Key**:
   - Create an Anthropic account and generate an API key at the [Anthropic Console](https://console.anthropic.com/).
   - In repository settings: **Secrets and variables** > **Actions**.
   - Create a secret named `ANTHROPIC_API_KEY` with your API key.
4. **Install Dependencies**:
   - Ensure [Node.js](https://nodejs.org/en) (v22+ recommended) is installed.
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

To customize metadata extraction:

1. Open and edit `src/system_prompts/prompt_analysis_agent/prompt.md`.
2. Run `npm run generate-metadata` to test.
3. Commit and push changes to trigger GitHub Actions.

> **Note**: Changes affect future metadata generations. Test thoroughly.

## 🧩 Using Fragments

Fragments are reusable prompt components.

To use fragments:

1. **Create a Fragment**:
   - In `fragments`, create a new `.md` file under the appropriate category (categories are listed [here](/src/system_prompts/prompt_analysis_agent/prompt.md)).
   - Create your fragment content.
   - To match a variable in a prompt, name the fragment file to correspond with that variable.

     **Example:** `awesome_guidelines.md` → `AWESOME_GUIDELINES`

2. **Update Metadata and Views**:
   - Regenerate metadata:
     ```
     FORCE_REGENERATE=true npm run generate-metadata
     ```
   - Update views:
     ```
     npm run update-views
     ```

Once metadata and views are regenerated, each prompt's README will list compatible fragments.

> **Note**: Forcing metadata regeneration can be costly; consider running selectively.

## 📝 Contributing

Contributions to improve templates, scripts, or structure are welcome! Submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
