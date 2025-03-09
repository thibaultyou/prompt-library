# 🧠 Prompt Library CLI

<div align="center">

  <p>
    <a href="https://github.com/thibaultyou/prompt-library/blob/main/LICENSE.md">
      <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
    </a>
    <a href="https://github.com/thibaultyou/prompt-library/actions/workflows/update_views.yml">
      <img src="https://github.com/thibaultyou/prompt-library/actions/workflows/update_views.yml/badge.svg" alt="Update Prompts and Views">
    </a>
  </p>

</div>

> 🚧 **Work in Progress**  
> This tool was recently refactored to use NestJS. Interactive menus are generally functional, but non-interactive commands need more testing and may be unstable. Comprehensive tests are still in progress. Use with caution and feel free to report any issues!
---

**Prompt Library CLI** is your personal, local-first toolkit for managing and executing sophisticated AI prompts. Store, organize, version control, and run prompts for **Claude (Anthropic)** and **GPT (OpenAI)** models directly from your terminal.

Treat AI prompts as **reusable mini-applications** that transform AI models into specialized agents.

## 📚 Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [🎯 Purpose & Features](#-purpose--features)
  - [Key Features](#key-features)
- [⚡ Quick Start](#-quick-start)
- [🛠️ How It Works](#-how-it-works)
  - [Recommended Workflow (CLI-First)](#recommended-workflow-cli-first)
  - [Alternative Workflow (Git-Based)](#alternative-workflow-git-based)
- [🖥️ CLI Usage](#-cli-usage)
  - [Main Commands](#main-commands)
  - [Common Tasks](#common-tasks)
- [📂 Prompt Showcase](#-prompt-showcase)
  - [Your AI Agent Collection](#your-ai-agent-collection)
- [🚀 Getting Started](#-getting-started)
  - [Step 1: Installation](#step-1-installation)
  - [Step 2: Initial Setup](#step-2-initial-setup)
  - [Step 3: Configure AI Provider & API Key](#step-3-configure-ai-provider--api-key)
  - [Step 4: Start Using!](#step-4-start-using)
- [🧩 Prompt Composition with Fragments](#-prompt-composition-with-fragments)
  - [Using Fragments](#using-fragments)
- [⚙️ Metadata Generation](#-metadata-generation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 🎯 Purpose & Features

This CLI promotes a structured approach to prompt engineering:

-   **Modularity**: Build complex interactions using reusable prompt fragments.
-   **Organization**: Categorize prompts with rich, automatically generated metadata.
-   **Version Control**: Manage your prompt library using Git, locally or with a remote.
-   **Reusability**: Apply successful prompts across different projects and contexts.
-   **Execution**: Run prompts interactively or non-interactively with variable support.
-   **Shareability**: Easily share your prompt library via Git.

### Key Features

✅ **Organized Local Storage** - Your prompts live in `~/.prompt-library` (or project dir in dev).
✅ **Git Integration** - Optional syncing with your own remote repository.
✅ **Multi-Model Support** - Configure and switch between Anthropic & OpenAI models.
✅ **Intelligent CLI** - Interactive menus and powerful command-line options.
✅ **Fragment System** - Compose prompts from reusable text snippets.
✅ **Variable Management** - Define and manage global or prompt-specific variables.
✅ **AI-Powered Metadata** - Automatically analyze prompts to generate descriptions, tags, etc. (optional).

## ⚡ Quick Start

```bash
# 1. Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/prompt-library.git

# 2. Install dependencies
cd prompt-library && npm install

# 3. Run in Development Mode (uses current directory for prompts)
npm run dev

# --- OR ---

# 3. Build and Install Globally (uses ~/.prompt-library)
npm run build
npm install -g .
prompt-library-cli menu # Start interactive menu

# 4. Initial Setup (IMPORTANT!)
# Run this after first launch to initialize your local library structure
prompt-library-cli setup
```

<details>
<summary>📋 Complete setup guide</summary>
<p>

See detailed instructions in [Getting Started](#-getting-started). You'll need to configure your AI provider API key using `prompt-library-cli model`.
</p>
</details>

## 🛠️ How It Works

The CLI primarily operates locally, managing prompts and fragments in your designated library directory (`~/.prompt-library/repository` by default).

### Recommended Workflow (CLI-First)

1.  **Create Prompts**: Use `prompt-library-cli prompt create` interactively. The CLI guides you through title, category, description, and content. AI analysis (optional, enabled by default) generates metadata (`metadata.yml`).
2.  **Create Fragments**: Use `prompt-library-cli fragment create` to build reusable text snippets.
3.  **Manage & Execute**: Use commands like `prompt list`, `prompt search`, `execute`, `env`, `model`, `config` to manage and run your library.
4.  **Sync (Optional)**: Use `prompt-library-cli sync` to push your local library changes to your configured remote Git repository.

### Alternative Workflow (Git-Based)

1.  **Manually Create Files**: Create `prompt.md` and `metadata.yml` files directly within category subdirectories inside `~/.prompt-library/repository/prompts`.
2.  **Sync Database**: Run `prompt-library-cli sync` (or the specific DB sync part if separated later) to update the local database with your filesystem changes.
3.  **Execute via CLI**: Run prompts using `prompt-library-cli execute`.
4.  **Git Push**: Manually commit and push changes using standard Git commands if you have a remote configured.

<details>
<summary>💡 Using GitHub Actions for Metadata (Optional)</summary>
<p>

If you maintain your prompt library in a dedicated GitHub repository (using the `sync` command or manually), you can enable GitHub Actions for automatic metadata updates:

1.  Fork this repository or use your own containing the library structure.
2.  Add your AI provider API key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) to your GitHub repository secrets.
3.  When you push commits containing new or modified `prompt.md` files, the included GitHub Action (`.github/workflows/update_views.yml`) can:
    *   Analyze the prompt content using AI.
    *   Generate or update the corresponding `metadata.yml` file.
    *   Update the main `README.md` showcase section.
    *   Commit these changes back to your repository.

**Note:** The CLI workflow (`prompt create`, `prompt update`) handles metadata generation locally and does *not* require GitHub Actions. Actions are only needed if you prefer a Git-centric workflow for metadata.
</p>
</details>

## 🖥️ CLI Usage

The CLI provides comprehensive commands for managing your prompt library.

### Main Commands

```bash
Usage: prompt-library-cli [options] [command]

Commands:
  menu                   (Default) Start the main interactive menu.
  execute [options]      Execute a specific prompt by ID or name, or via local files.
  prompt [subcommand]    Manage and browse prompts (list, search, create, update, delete, etc.).
  fragment [subcommand]  Manage reusable prompt fragments (list, create, update, delete, etc.).
  env [subcommand]       Manage global and prompt-specific environment variables (list, create, update, delete, read).
  model [options]        Configure AI model provider, model, and API key.
  config [options]       Manage CLI configuration settings.
  repository [options]   Manage the connection to your prompt library repository.
  sync [options]         Synchronize your local library with a remote Git repository.
  setup                  Initialize or configure the prompt library repository location.
  flush                  ⚠️ Reset all application data (prompts, fragments, history). Preserves config.
  generate-docs          Manually regenerate README files based on current prompts.
  help [command]         Display help for command.
```

> **Tip**: Run `prompt-library-cli <command> --help` for detailed options on each command (e.g., `prompt-library-cli prompt --help`, `prompt-library-cli prompt create --help`).

### Common Tasks

```bash
# Start interactive menu (recommended for exploration)
prompt-library-cli menu
# or just:
prompt-library-cli

# Initial setup
prompt-library-cli setup

# Configure AI Model (API Key, Provider, Model)
prompt-library-cli model

# Execute a prompt interactively (will prompt for variables)
prompt-library-cli execute -p <prompt_id_or_name>

# Execute non-interactively with variables
prompt-library-cli execute -p <id> --variable_one "value1" --another_var "value2"

# Execute with file content as input for a variable
prompt-library-cli execute -p <id> -fi input_data=./path/to/file.txt

# List all prompts
prompt-library-cli prompt list # or 'prompt ls'

# Search for prompts
prompt-library-cli prompt search "data analysis"

# Create a new prompt (interactive)
prompt-library-cli prompt create

# Update a prompt (interactive)
prompt-library-cli prompt update

# Delete a prompt (interactive, will ask for confirmation)
prompt-library-cli prompt delete

# List all fragments
prompt-library-cli fragment list

# Create a new fragment (interactive)
prompt-library-cli fragment create

# List environment variables
prompt-library-cli env list

# Set an environment variable (will create or update)
prompt-library-cli env update --key-value MY_API_URL=https://example.com/api # or 'env set ...'

# Set an environment variable to reference a fragment
prompt-library-cli env update --fragment COMMON_HEADER=templates/email_header

# Sync local changes with your remote Git repository (if configured)
prompt-library-cli sync
```

<details>
<summary>📚 Advanced CLI Usage</summary>

```bash
# --- Prompts ---
# List prompts sorted by ID
prompt-library-cli prompt list --id
# List only prompt categories
prompt-library-cli prompt list --categories
# View prompt details non-interactively
prompt-library-cli prompt read --prompt <id>
# Create prompt non-interactively from file
prompt-library-cli prompt create --title "My Agent" --category "coding" --description "Does things" --file ./prompt.md --directory my_agent --no-analyze
# Update prompt non-interactively with new content string
prompt-library-cli prompt update --prompt <id> --content "New prompt text..." --no-analyze
# Delete prompt non-interactively (force skip confirmation)
prompt-library-cli prompt delete --prompt <id> --force
# Refresh metadata for a specific prompt
prompt-library-cli prompt refresh-metadata --prompt <id>
# Refresh metadata for ALL prompts
prompt-library-cli prompt refresh-metadata --all
# List recent prompts (e.g., last 5)
prompt-library-cli prompt recent --limit 5
# List favorite prompts
prompt-library-cli prompt favorites

# --- Fragments ---
# List fragments non-interactively
prompt-library-cli fragment list # or 'fragment ls'
# Create fragment non-interactively
prompt-library-cli fragment create --category common --name header --content "# Header"
# Update fragment non-interactively from file
prompt-library-cli fragment update --category common --name header --file ./new_header.md
# Delete fragment non-interactively (force skip confirmation)
prompt-library-cli fragment delete --category common --name header --force

# --- Environment Variables ---
# Create/Update variable non-interactively (update is alias for set)
prompt-library-cli env update --key-value MY_VAR=abc
prompt-library-cli env update --fragment CONTEXT=common/project_details
# Delete custom variable non-interactively
prompt-library-cli env delete --name MY_VAR --force # Only deletes custom vars
# Read variable details non-interactively
prompt-library-cli env read --name MY_VAR
# Read variable value non-interactively
prompt-library-cli env read --name MY_VAR --value
# Read variable sources non-interactively (show prompt IDs)
prompt-library-cli env read --name MY_VAR --sources
# Read variable sources non-interactively (show prompt titles)
prompt-library-cli env read --name MY_VAR --sources --show-titles
# Get list output as JSON
prompt-library-cli env list --json

# --- Execution ---
# Inspect prompt variables without running
prompt-library-cli execute -p <id> --inspect # or -i
# Execute with JSON output (includes full response, timing, etc.)
prompt-library-cli execute -p <id> --json
# Execute with multiple file inputs
prompt-library-cli execute -p <id> -fi input1=./file1.txt -fi input2=./file2.log

# --- Configuration ---
# View specific config key non-interactively
prompt-library-cli config --key MODEL_PROVIDER
# Set config key non-interactively
prompt-library-cli config --key OPENAI_MODEL --value gpt-4o
# Reset config to defaults non-interactively
prompt-library-cli config --reset
# View config as JSON
prompt-library-cli config --json

# --- Repository & Sync ---
# View repository status details
prompt-library-cli repository # (Select 'View Status' or 'Change Branch' interactively)
# List pending local changes
prompt-library-cli sync --list
# Push pending local changes (requires commit message interactively or default non-interactively)
prompt-library-cli sync --push
# Push to a specific branch
prompt-library-cli sync --push --branch feature/my-prompts
# Reset (discard) all local changes non-interactively
prompt-library-cli sync --reset --force
```

</details>

## 📂 Prompt Showcase

<div align="center">

### Your AI Agent Collection

*A starting point for building specialized AI agents.*

</div>

> **Note:** These are example prompts included with the library. Create your own collection tailored to your needs using `prompt create`!
<details>
<summary><strong>🔹 Coding</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [Git Branch Name Generator](git_branch_name_generator/README.md) | Generates optimized git branch names based on project context and user requirements                       |
| [Git Commit Message Agent](git_commit_message_agent/README.md) | Generates precise and informative git commit messages following Conventional Commits specification                       |
| [GitHub Issue Creator](github_issue_creator_agent/README.md) | Creates comprehensive and actionable GitHub issues based on provided project information                       |
| [Software Architect Code Reviewer](software_architect_code_reviewer/README.md) | Generates comprehensive pull requests with architectural analysis and optimization suggestions                       |
| [Software Architect Specification Creator](software_architect_spec_creator/README.md) | Creates comprehensive software specification documents based on user requirements                       |
| [Software Architect Visionary](software_architect_agent/README.md) | Analyzes user requirements and creates comprehensive software specification documents                       |
| [Software Development Expert Agent](software_dev_expert_agent/README.md) | Provides expert, adaptive assistance across all aspects of the software development lifecycle.                       |

</details>
<details>
<summary><strong>🔹 Content Creation</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [Documentation Specialist Agent](documentation_specialist_agent/README.md) | Generates revolutionary software documentation using advanced AI techniques and industry best practices                       |

</details>
<details>
<summary><strong>🔹 Healthcare</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [Health Optimization Agent](health_optimization_agent/README.md) | Generates personalized, adaptive health optimization plans based on comprehensive user data analysis                       |
| [Psychological Support and Therapy Agent](psychological_support_agent/README.md) | Provides AI-driven psychological support and therapy through digital platforms                       |

</details>
<details>
<summary><strong>🔹 Problem Solving</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [Problem Solving AI Agent](problem_solving_ai_agent/README.md) | Generates expert networks and strategies to solve complex problems and achieve goals                       |

</details>
<details>
<summary><strong>🔹 Prompt Engineering</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [AI Assistant Concept Architect](ai_assistant_architect/README.md) | Conceptualizes innovative, feasible AI assistants addressing real-world challenges                       |
| [Prompt Engineering God](prompt_engineering_agent/README.md) | Crafts divine-tier prompts to maximize AI potential while adhering to ethical standards                       |

</details>
<details>
<summary><strong>🔹 Translation</strong></summary>

| Prompt                                     | Description                                    |
| :----------------------------------------- | :--------------------------------------------- |
| [Universal Translator Agent](universal_translator_agent/README.md) | Translates between any languages, modes of expression, or conceptual frameworks                       |

</details>

<div align="center">
  <p><em>💡 Pro Tip: Check out the <strong>Prompt Engineering</strong> category for prompts that help you create high-quality prompts</em></p>
</div>

## 🚀 Getting Started

### Step 1: Installation

```bash
# Fork the repository on GitHub first (optional, for backup/sharing)
# Clone the repository (or your fork)
git clone https://github.com/thibaultyou/prompt-library.git
cd prompt-library

# Install dependencies
npm install

# Build the project
npm run build

# Install the CLI globally
npm install -g .

# Verify installation
prompt-library-cli --version
```

### Step 2: Initial Setup

Run the setup command. This creates the necessary directories (usually in `~/.prompt-library`) where your prompts, fragments, database, and config will be stored locally.

```bash
prompt-library-cli setup
```

You'll be asked if you want to clone a remote repository, use an existing local folder, or create a default empty structure.

### Step 3: Configure AI Provider & API Key

Configure the AI model you want to use. The CLI will guide you through selecting a provider (Anthropic/OpenAI) and entering your API key.

```bash
prompt-library-cli model
```

<details>
<summary>🔵/🟢 Where to get API Keys</summary>
<p>

-   **Anthropic Claude**: Get an API key from the [Anthropic Console](https://console.anthropic.com/).
-   **OpenAI GPT**: Get an API key from the [OpenAI Platform](https://platform.openai.com/api-keys).

The key will be stored securely in the CLI's configuration file (`~/.prompt-library/.config/config.json`).
</p>
</details>

### Step 4: Start Using!

You're ready to go!

```bash
# Start the interactive menu
prompt-library-cli

# Or use direct commands
prompt-library-cli prompt list
prompt-library-cli prompt create
prompt-library-cli execute -p <some_prompt_id>
```

## 🧩 Prompt Composition with Fragments

Fragments are reusable text snippets stored in the `fragments/` directory, organized by category (e.g., `fragments/common/disclaimer.md`).

### Using Fragments

1.  **Create**: Use `prompt-library-cli fragment create` or manually create `.md` files.
2.  **Reference**: Include fragments in your `prompt.md` files using `{{VARIABLE_NAME}}` syntax. Set the corresponding variable's value to `Fragment: category/name` using `prompt-library-cli env update --fragment VARIABLE_NAME=category/name`.
3.  **Manage**: Use `prompt-library-cli fragment` commands (`list`, `search`, `update`, `delete`).

> **Examples**: Check the included `fragments/prompt_engineering/` directory for examples like behavior guidelines, formatting instructions, and safety rules.

## ⚙️ Metadata Generation

The CLI uses AI to help generate metadata (`metadata.yml`) when you create or update prompts using `prompt create` or `prompt update`.

-   **Automatic Analysis**: By default (`--analyze` flag is true), the CLI sends your prompt content to the configured AI model along with a system prompt (`system_prompts/prompt_analysis_agent/prompt.md`) to generate the title, description, tags, variables, etc.
-   **Skip Analysis**: Use the `--no-analyze` flag during create/update to skip the AI analysis and provide metadata manually or rely on basic extraction.
-   **Refresh**: Use `prompt-library-cli prompt refresh-metadata` (with `--prompt <id>` or `--all`) to re-analyze existing prompts.
-   **Customization**: You can modify the system prompt used for analysis by editing `src/system_prompts/prompt_analysis_agent/prompt.md` (requires rebuilding the CLI if installed globally).

## 🤝 Contributing

Contributions are welcome! Please refer to the project's contribution guidelines (if available) or submit issues and pull requests via GitHub.

## 📄 License

This project is licensed under the [MIT License](LICENSE.md).
