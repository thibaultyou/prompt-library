# 🧠 Prompt Library

<div align="center">

  <p>
    <!-- <a href="https://github.com/thibaultyou/prompt-library/releases">
      <img src="https://img.shields.io/github/package-json/v/thibaultyou/prompt-library" alt="Version">
    </a> -->
    <a href="https://github.com/thibaultyou/prompt-library/blob/main/LICENSE.md">
      <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
    </a>
    <a href="https://github.com/thibaultyou/prompt-library/actions/workflows/update_views.yml">
      <img src="https://github.com/thibaultyou/prompt-library/actions/workflows/update_views.yml/badge.svg" alt="Update Prompts and Views">
    </a>
  </p>

</div>

> 🚧 **Project Under Development** - Evolving project, expect changes. Feedback welcome!

**Prompt Library** is your personal collection of AI agent prompts that transforms the way you interact with AI models. Store, organize, and execute sophisticated prompts through an intuitive CLI - supporting both Claude (Anthropic) and GPT (OpenAI) models.

## 📚 Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [🎯 Purpose & Features](#-purpose--features)
  - [Key Features](#key-features)
- [⚡ Quick Start](#-quick-start)
- [🛠️ How It Works](#-how-it-works)
  - [Option 1: CLI Workflow (Recommended)](#option-1-cli-workflow-recommended)
  - [Option 2: Git-based Workflow](#option-2-git-based-workflow)
- [🖥️ CLI Usage](#-cli-usage)
  - [Command Overview](#command-overview)
  - [Common Tasks](#common-tasks)
- [📂 Prompt Showcase](#-prompt-showcase)
  - [Your AI Agent Collection](#your-ai-agent-collection)
- [🚀 Getting Started](#-getting-started)
  - [Step 1: Installation and Setup](#step-1-installation-and-setup)
  - [Step 2: Configure API Access](#step-2-configure-api-access)
  - [Step 3: Install and Run CLI](#step-3-install-and-run-cli)
  - [Step 4: For GitHub Actions (Optional)](#step-4-for-github-actions-optional)
- [🧩 Prompt Composition with Fragments](#-prompt-composition-with-fragments)
  - [Using Fragments](#using-fragments)
- [⚙️ Customizing Metadata Generation](#-customizing-metadata-generation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 🎯 Purpose & Features

Treat AI prompts as **reusable mini-applications** that transform AI models into specialized agents. This approach promotes:

- **Modularity**: Compose complex prompts from reusable components
- **Reusability**: Apply successful prompts across multiple projects
- **Shareability**: Exchange proven prompts with your team

In today's rapidly evolving AI landscape, maintaining a personal prompt library is becoming essential for individuals and organizations alike.

### Key Features

✅ **Organized Prompt Storage** - Categorized structure with rich metadata  
✅ **Multi-Model Support** - Works with both Claude and GPT family models  
✅ **Intelligent CLI** - Interactive prompt execution with variable support  
✅ **Fragment System** - Build prompts from reusable components  
✅ **Automatic Metadata** - GitHub Actions maintain documentation  
✅ **Dev-Friendly** - TypeScript codebase with comprehensive testing

## ⚡ Quick Start

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/prompt-library.git

# Install dependencies
cd prompt-library && npm install

# Choose how to run the CLI:

# Option 1: Run directly in development mode
npm run dev

# Option 2: Build and install globally
npm run build && npm install -g .
prompt-library-cli

# After first run, set up your prompt library
prompt-library-cli setup
```

<details>
<summary>📋 Complete setup guide</summary>
<p>

See detailed instructions in [Getting Started](#-getting-started).
</p>
</details>

## 🛠️ How It Works

### Option 1: CLI Workflow (Recommended)

1. **Create Prompts**: Use `prompt-library-cli prompts create` to create new prompts interactively
2. **Generate Metadata**: AI analysis automatically generates metadata for your prompts
3. **Organize and Manage**: Update, search, and execute prompts through the CLI
4. **Push to GitHub**: Optionally sync your changes with a remote repository

### Option 2: Git-based Workflow

1. **Create Prompts**: Write markdown prompt files in the `prompts` directory
2. **Generate Metadata**: Commit to trigger automatic metadata generation via GitHub Actions
3. **Organize Automatically**: README files update with categorized prompt listings
4. **Execute via CLI**: Run prompts through the interactive CLI or command line

<details>
<summary>💡 Pro Tip: Working with GitHub Actions</summary>
<p>

To use the GitHub Actions workflow for metadata generation:
1. Add your AI provider API key (Anthropic or OpenAI) to your GitHub repository secrets
2. Create and commit `prompt.md` files to trigger the automatic generation of `metadata.yml` files
3. Both files are required for CLI prompt usage

The CLI-based workflow doesn't require GitHub Actions and can be used entirely offline.
</p>
</details>

## 🖥️ CLI Usage

The CLI offers a complete prompt management and execution solution:

### Command Overview

```bash
Usage: prompt-library-cli [options] [command]

Commands:
  # Core Commands
  execute                Run a specific prompt by ID or name
  prompts                List and manage prompts
  fragments              Manage prompt fragments
  sync                   Sync with prompt repository
  
  # Prompt Management Commands
  prompts --list         List all prompts
  prompts --search       Search for prompts by keyword
  prompts --categories   Show prompt categories
  prompts create         Create a new prompt
  prompts edit           Edit an existing prompt
  prompts delete         Delete a prompt
  
  # Fragment Management Commands
  fragments --list       List all fragments
  fragments --search     Search for fragments by keyword
  fragments --categories Show fragment categories
  fragments create       Create a new fragment
  fragments edit         Edit a fragment
  fragments delete       Delete a fragment
  
  # Configuration Commands
  model                  Configure AI model settings
  config                 Manage CLI configuration
  env                    Manage environment variables
  repository             Manage prompt repository
  setup                  Set up prompt library
  flush                  Reset all data (preserves config)
  
  # Global Options
  -V, --version          Output the version number
  -h, --help             Display help for command
```

### Common Tasks

```bash
# Switch between AI models (Claude/GPT)
prompt-library-cli model

# Execute a prompt
prompt-library-cli execute -p "git_commit"    # By name (fuzzy matching)
prompt-library-cli execute -p 74              # By ID (more reliable)

# Execute with clean output (only AI response, ideal for scripting)
prompt-library-cli execute -p "commit" --description "Add auth" --files "auth.ts,users.ts"
prompt-library-cli execute -p "mail_agent" --email_content "Your inquiry"

# Execute with file inputs
prompt-library-cli execute -p "translator" -fi input=./document.txt

# Execute with verbose output
prompt-library-cli execute -p "mail_agent" --email_content "Your inquiry" --verbose

# Manage prompts
prompt-library-cli prompts --list             # List all prompts
prompt-library-cli prompts --search "git"     # Search by keyword
prompt-library-cli prompts --categories       # Show categories
prompt-library-cli prompts create             # Create a new prompt  
prompt-library-cli prompts edit -p 74         # Edit a prompt
prompt-library-cli prompts delete -p 74       # Delete a prompt
```

> **Tip**: While both names and IDs work, using IDs (like 74) is more reliable than names.

<details>
<summary>📚 Advanced CLI Usage</summary>

```bash
# Working with Fragments
prompt-library-cli fragments                  # Interactive fragments menu
prompt-library-cli fragments --list           # List all fragments
prompt-library-cli fragments --search "fmt"   # Search fragments
prompt-library-cli fragments create --category prompt_engineering --name my_fragment  # Create
prompt-library-cli fragments edit --category prompt_engineering --name my_fragment    # Edit
prompt-library-cli fragments delete --category prompt_engineering --name my_fragment  # Delete

# Advanced Prompt Execution
prompt-library-cli execute -p 74 --json                # Show detailed execution info as JSON
prompt-library-cli execute -p 74 --var1 "val" --var2 "val2"  # Set multiple variables
prompt-library-cli execute -p 74 -i                    # Inspect prompt variables
prompt-library-cli execute -p 74 > output.txt          # Redirect clean output to file

# Repository Management
prompt-library-cli sync                       # Sync with remote repository
prompt-library-cli sync --list                # Check pending changes
prompt-library-cli sync --push                # Push changes to remote
prompt-library-cli sync --reset               # Discard local changes
prompt-library-cli repository                 # Repository settings menu
prompt-library-cli repository --status        # Show repo status

# Environment Variable Management
prompt-library-cli env                        # Manage environment variables interactively  
prompt-library-cli env --list                 # List all environment variables
prompt-library-cli env --set KEY=value        # Set an environment variable
prompt-library-cli env --fragment KEY=cat/name # Set variable to fragment reference
prompt-library-cli env --unset KEY            # Unset a variable's value
prompt-library-cli env --info KEY             # Show detailed variable info
prompt-library-cli env --view KEY             # View raw variable value
prompt-library-cli env --sources KEY          # Show all prompts using this variable
prompt-library-cli env --sources KEY --show-titles # Show prompts with titles
prompt-library-cli env --list --json          # Get variables in JSON format
prompt-library-cli env --info KEY --json      # Get variable details as JSON

# Configuration Settings
prompt-library-cli config                     # Configure CLI settings
prompt-library-cli setup --repository https://github.com/your-username/repo.git  # Custom repo
prompt-library-cli flush                      # Reset all data (preserves config)
```

> **Note**: API keys are stored securely and never displayed in full.
</details>

## 📂 Prompt Showcase

<div align="center">
  
### Your AI Agent Collection
*Create custom agents for any task with our pre-built prompt templates*

</div>

> **Note:** These prompts are fully customizable examples. Build your own collection based on your unique needs.
<details>
<summary><strong>🔹 Coding</strong></summary>

| Prompt | Description |
|--------|-------------|
| [Git Branch Name Generator](prompts/git_branch_name_generator/README.md) | Generates optimized git branch names based on project context and user requirements |
| [Git Commit Message Agent](prompts/git_commit_message_agent/README.md) | Generates precise and informative git commit messages following Conventional Commits specification |
| [GitHub Issue Creator](prompts/github_issue_creator_agent/README.md) | Creates comprehensive and actionable GitHub issues based on provided project information |
| [Software Architect Code Reviewer](prompts/software_architect_code_reviewer/README.md) | Generates comprehensive pull requests with architectural analysis and optimization suggestions |
| [Software Architect Specification Creator](prompts/software_architect_spec_creator/README.md) | Creates comprehensive software specification documents based on user requirements |
| [Software Architect Visionary](prompts/software_architect_agent/README.md) | Analyzes user requirements and creates comprehensive software specification documents |
| [Software Development Expert Agent](prompts/software_dev_expert_agent/README.md) | Provides expert, adaptive assistance across all aspects of the software development lifecycle. |

</details>
<details>
<summary><strong>🔹 Content Creation</strong></summary>

| Prompt | Description |
|--------|-------------|
| [Documentation Specialist Agent](prompts/documentation_specialist_agent/README.md) | Generates revolutionary software documentation using advanced AI techniques and industry best practices |

</details>
<details>
<summary><strong>🔹 Healthcare</strong></summary>

| Prompt | Description |
|--------|-------------|
| [Health Optimization Agent](prompts/health_optimization_agent/README.md) | Generates personalized, adaptive health optimization plans based on comprehensive user data analysis |
| [Psychological Support and Therapy Agent](prompts/psychological_support_agent/README.md) | Provides AI-driven psychological support and therapy through digital platforms |

</details>
<details>
<summary><strong>🔹 Problem Solving</strong></summary>

| Prompt | Description |
|--------|-------------|
| [Problem Solving AI Agent](prompts/problem_solving_ai_agent/README.md) | Generates expert networks and strategies to solve complex problems and achieve goals |

</details>
<details>
<summary><strong>🔹 Prompt Engineering</strong></summary>

| Prompt | Description |
|--------|-------------|
| [AI Assistant Architect](prompts/ai_assistant_architect/README.md) | Conceptualizes innovative and feasible AI assistant designs for various domains |
| [Prompt Engineering God](prompts/prompt_engineering_agent/README.md) | Crafts divine-tier prompts to maximize AI potential while adhering to ethical standards |

</details>
<details>
<summary><strong>🔹 Translation</strong></summary>

| Prompt | Description |
|--------|-------------|
| [Universal Translator Agent](prompts/universal_translator_agent/README.md) | Translates between any languages, modes of expression, or conceptual frameworks |

</details>

<div align="center">
  <p><em>💡 Pro Tip: Check out the <strong>Prompt Engineering</strong> category for prompts that help you create high-quality prompts</em></p>
</div>

## 🚀 Getting Started

### Step 1: Installation and Setup

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/prompt-library.git
cd prompt-library

# Install dependencies
npm install

# Choose how to run the CLI:

# Option 1: Run directly in development mode
npm run dev

# Option 2: Build and install globally
npm run build && npm install -g .
prompt-library-cli

# After first run, set up your prompt library
prompt-library-cli setup
```

This will create a repository at ~/.prompt-library/repository that:
- Stores your prompts separately from the CLI code
- Can be backed up to your own GitHub repository
- Makes it easy to share your prompt collection with others

### Step 2: Configure API Access

Choose your preferred AI provider:

<details>
<summary>🔵 <strong>Anthropic Claude</strong></summary>
<p>

1. Get an API key from the [Anthropic Console](https://console.anthropic.com/)
2. Set the environment variable: `export ANTHROPIC_API_KEY=your_key_here`
</p>
</details>

<details>
<summary>🟢 <strong>OpenAI GPT</strong></summary>
<p>

1. Get an API key from the [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set the environment variable: `export OPENAI_API_KEY=your_key_here`
</p>
</details>

### Step 3: Install and Run CLI

```bash
# Build TypeScript project
npm run build

# Install CLI globally
npm install -g .

# Launch interactive CLI
prompt-library-cli

# Configure your AI model
prompt-library-cli model
```

> **Note**: On first run, you'll need to configure which AI model to use. The CLI will guide you through selecting a provider (Anthropic/OpenAI), model, and token settings.

### Step 4: For GitHub Actions (Optional)

If you want automatic metadata generation and README updates via GitHub Actions:
1. Fork the repository to your GitHub account
2. Add your API key to repository secrets:
   - Go to your GitHub repository → Settings → Secrets → New repository secret
   - Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
3. When you commit new prompt files, GitHub Actions will:
   - Generate metadata.yml files for new prompts
   - Update all README files with the latest prompt information

## 🧩 Prompt Composition with Fragments

Fragments are reusable prompt components that help build complex prompts efficiently:

```markdown
# Example prompt with fragments
I need you to help me with {{TASK_TYPE}}.

{{BEHAVIOR_GUIDELINES}}

Context:
{{USER_CONTEXT}}

Now, please {{SPECIFIC_INSTRUCTION}}.
```

### Using Fragments

1. Create fragment as `.md` files in `fragments/` directory
2. Reference them with `{{FRAGMENT_NAME}}` syntax
3. Manage them with `prompt-library-cli fragments`

> **Examples**: Check [prompt_engineering](/fragments/prompt_engineering/) fragments for behavior guidelines, formatting instructions, safety rules, and output templates.

## ⚙️ Customizing Metadata Generation

The system automatically analyzes prompts and generates metadata using AI:

```bash
# CLI-based Customization
prompt-library-cli prompts edit               # Edit a prompt interactively
prompt-library-cli prompts edit --no-analyze  # Skip AI analysis

# System-level Customization
# 1. Modify src/system_prompts/prompt_analysis_agent/prompt.md
# 2. Test with: npm run update-metadata
# 3. Commit to trigger GitHub Actions updates
```

> **Note**: System prompt changes affect all future analyses in both CLI and GitHub Actions. You can work entirely offline with the CLI without GitHub Actions.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

- **Add New Prompts**: Share your best prompt designs
- **Improve Templates**: Enhance the prompt structure
- **Fix Bugs**: Help improve the CLI functionality
- **Add Features**: Extend the system's capabilities

Please submit issues or pull requests through GitHub.

## 📄 License

This project is licensed under the [MIT License](LICENSE.md) - feel free to use, modify, and distribute as needed.
