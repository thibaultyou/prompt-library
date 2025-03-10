# 🧠 Prompt Library

<div align="center">

  <p>
    <a href="https://github.com/thibaultyou/prompt-library/releases">
      <img src="https://img.shields.io/github/package-json/v/thibaultyou/prompt-library" alt="Version">
    </a>
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

<!-- START doctoc -->
<!-- END doctoc -->

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

### Option 1: Global Installation (Recommended for Users)

```bash
# Install CLI globally from npm (coming soon)
npm install -g prompt-library-cli

# Run setup to create your prompt library
prompt-library-cli setup

# Launch interactive prompt menu
prompt-library-cli
```

### Option 2: Development Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/prompt-library.git

# Install dependencies
cd prompt-library && npm install

# Build and install CLI globally
npm run build && npm install -g .

# Run setup to create your prompt library
prompt-library-cli setup

# Or run directly from source in development mode
npm run dev
```

<details>
<summary>📋 Complete setup guide</summary>
<p>

See detailed instructions in [Getting Started](#-getting-started).
</p>
</details>

## 🛠️ How It Works

1. **Create Prompts**: Write markdown prompt files in the `prompts` directory
2. **Generate Metadata**: Commit to trigger automatic metadata generation
3. **Organize Automatically**: README files update with categorized prompt listings
4. **Execute via CLI**: Run prompts through the interactive CLI or command line

<details>
<summary>💡 Pro Tip: Working with GitHub Actions</summary>
<p>

Create and commit `prompt.md` files individually to allow GitHub Actions to generate corresponding `metadata.yml` files. Both files are required for CLI prompt usage.
</p>
</details>

## 🖥️ CLI Usage

The CLI offers a complete prompt management and execution solution:

### Command Overview

| Command | Description | Example |
|---------|-------------|---------|
| `prompt-library-cli` | Interactive menu | `prompt-library-cli` |
| `model` | Configure AI model settings | `prompt-library-cli model` |
| `prompts` | List and manage prompts | `prompt-library-cli prompts --list` |
| `execute` | Run a specific prompt | `prompt-library-cli execute -p 74` |
| `fragments` | Manage prompt fragments | `prompt-library-cli fragments --list` |
| `config` | Manage CLI configuration | `prompt-library-cli config` |
| `env` | Manage environment variables | `prompt-library-cli env` |
| `sync` | Sync with prompt repository | `prompt-library-cli sync --push` |
| `repository` | Manage prompt repository | `prompt-library-cli repository` |
| `settings` | Manage CLI settings | `prompt-library-cli settings` |
| `setup` | Set up prompt library | `prompt-library-cli setup` |
| `flush` | Reset all data (preserves config) | `prompt-library-cli flush` |

### Global Options

```bash
Usage: prompt-library-cli [options] [command]

Options:
  -V, --version               Output the version number
  -e, --execute <id_or_name>  Execute a prompt by ID or name
  -l, --list                  List all available prompts
  -s, --search <keyword>      Search prompts by keyword
  -h, --help                  Display help for command
```

### 🔄 Switch AI Models

```bash
prompt-library-cli model
```

The streamlined model menu lets you:
- 🤖 **Change AI provider**: Switch between Anthropic (Claude) or OpenAI (GPT)
- 🧠 **Change model**: Select from available models for your provider
- 🔋 **Change max tokens**: Adjust token limits for your responses

### 🚀 Execute Prompts

```bash
# List available prompts (to see IDs and names)
prompt-library-cli prompts --list

# Execute using prompt ID (most reliable)
prompt-library-cli execute -p 80  # ID for Software Architect Visionary

# Execute using prompt name (partial matches work too)
prompt-library-cli execute -p "git_commit_message_agent"
prompt-library-cli execute -p "commit message"

# With variables
prompt-library-cli execute -p 74 --description "Add user authentication" --files "auth.ts,users.ts"
# Or by name
prompt-library-cli execute -p "commit" --description "Add user authentication" --files "auth.ts,users.ts"

# Use file inputs
prompt-library-cli execute -p 81 -fi code=./my-code.ts

# Preview/inspect mode (don't execute, just view variables)
prompt-library-cli execute -p "translator" -i

# Specify metadata and prompt files directly
prompt-library-cli execute -f ./my-prompt.md -m ./my-metadata.yml
```

> **Tip**: While both prompt IDs and names are supported, using IDs is more reliable. Directory names follow the pattern `{function}_{domain}_agent` and are matched using fuzzy search.

### 🔎 Managing Prompts

```bash
# List all prompts with their IDs and categories
prompt-library-cli prompts --list

# List all prompt categories
prompt-library-cli prompts --categories

# Search prompts by keyword (title, description, category)
prompt-library-cli prompts --search "git"

# Show favorite prompts
prompt-library-cli prompts --favorites

# Show recently executed prompts
prompt-library-cli prompts --recent

# Output in JSON format (for scripting/CI)
prompt-library-cli prompts --list --json

# Create a new prompt
prompt-library-cli prompts create

# Edit an existing prompt
prompt-library-cli prompts edit

# Delete a prompt
prompt-library-cli prompts delete
```

<details>
<summary>📚 Advanced CLI Usage</summary>
<p>

#### Executing Prompts with Files

```bash
# Execute a prompt with file input
prompt-library-cli execute -p "translator" -fi input=./document.txt

# Execute with multiple file inputs
prompt-library-cli execute -p "code_review" -fi code=./src/app.js -fi tests=./tests/app.test.js

# Execute with both file inputs and regular variables
prompt-library-cli execute -p "document_generator" -fi template=./template.md --title "Project Overview" --author "Team"
```

#### Working with Fragments

```bash
# Open interactive fragments menu
prompt-library-cli fragments

# List all available fragments
prompt-library-cli fragments --list

# List all fragment categories
prompt-library-cli fragments --categories

# Search fragments by keyword (name or category)
prompt-library-cli fragments --search "formatting"

# Output in JSON format (for CI/scripting)
prompt-library-cli fragments --list --json

# Create a new fragment
prompt-library-cli fragments create -c prompt_engineering -n my_fragment

# Edit an existing fragment
prompt-library-cli fragments edit -c prompt_engineering -n existing_fragment  

# Delete a fragment
prompt-library-cli fragments delete -c prompt_engineering -n obsolete_fragment

# Force delete without confirmation
prompt-library-cli fragments delete -c prompt_engineering -n obsolete_fragment -f

# Use with scripts (pipe output to another program)
prompt-library-cli fragments --list --json | jq
```

#### Sync Options

```bash
# Fetch latest prompts from the default repository
prompt-library-cli sync

# Specify a custom repository URL
prompt-library-cli sync -u https://github.com/your-username/your-repo.git

# Force sync without confirmation
prompt-library-cli sync --force

# List pending changes that need to be synced
prompt-library-cli sync --list

# Push local changes to remote repository
prompt-library-cli sync --push

# Reset/discard local changes
prompt-library-cli sync --reset

# Push to specific branch name
prompt-library-cli sync --push --branch my-feature-branch
```

#### Environment Management

```bash
# Set environment variables for API keys
prompt-library-cli env

# The interactive menu guides you through setting API keys and other environment variables
```

> **Note**: For security, your API keys are stored securely and never logged or displayed in full.

</p>
</details>

## 📂 Prompt Showcase

<div align="center">
  
### Your AI Agent Collection
*Create custom agents for any task with our pre-built prompt templates*

</div>

> **Note:** These prompts are fully customizable examples. Build your own collection based on your unique needs.

{%- for category, prompts in categories %}
<details>
<summary><strong>🔹 {{ format_string(category) }}</strong></summary>

| Prompt | Description |
|--------|-------------|
{%- for prompt in prompts %}
| [{{ prompt.title }}]({{ prompt.path }}) | {{ prompt.description }} |
{%- endfor %}

</details>
{%- endfor %}

<div align="center">
  <p><em>💡 Pro Tip: Check out the <strong>Prompt Engineering</strong> category for prompts that help you create high-quality prompts</em></p>
</div>

## 🚀 Getting Started

### Step 1: Installation and Setup

Choose your preferred installation method:

<details>
<summary>🏆 <strong>Option 1: Standard Installation (Recommended)</strong></summary>
<p>

```bash
# Install CLI globally from npm (coming soon)
npm install -g prompt-library-cli

# Run setup to create a dedicated prompt library repository
prompt-library-cli setup

# This will create a repository at ~/.prompt-library/repository
```

This approach keeps your prompts in a dedicated repository separate from the CLI code, making it easier to:
- Update the CLI independently from your content
- Back up your prompts to your own GitHub repository
- Share your prompt collection with others

</p>
</details>

<details>
<summary>💻 <strong>Option 2: Developer Installation</strong></summary>
<p>

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/prompt-library.git
cd prompt-library

# Install dependencies
npm install

# Build and install globally
npm run build && npm install -g .

# Run the setup to create your prompt library
prompt-library-cli setup
```

This approach is ideal if you want to customize the CLI or contribute to development.

</p>
</details>

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

If you want automatic README generation, add your API key to repository secrets:
- Go to your GitHub repository → Settings → Secrets → New repository secret
- Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

## 🧩 Prompt Composition with Fragments

Fragments are modular, reusable prompt components that help you build complex prompts efficiently:

```markdown
# Example prompt using fragments
I need you to help me with {% raw %}{{TASK_TYPE}}{% endraw %}.

{% raw %}{{BEHAVIOR_GUIDELINES}}{% endraw %}

Context:
{% raw %}{{USER_CONTEXT}}{% endraw %}

Now, please {% raw %}{{SPECIFIC_INSTRUCTION}}{% endraw %}.
```

### Creating Fragments

1. Add `.md` files to the `fragments/` directory (categorized by type)
2. Reference them in your prompt files with `{% raw %}{{FRAGMENT_NAME}}{% endraw %}`
3. Browse and manage fragments with `prompt-library-cli fragments`

<details>
<summary>🔍 <strong>Fragment Examples</strong></summary>
<p>

Check the [prompt_engineering](/fragments/prompt_engineering/) directory for example fragments including:
- Behavior attributes
- Formatting guidelines 
- Safety guidelines
- Output templates

</p>
</details>

## ⚙️ Customizing Metadata Generation

The system automatically analyzes prompts and generates metadata. To customize this process:

1. Modify the system prompt at `src/system_prompts/prompt_analysis_agent/prompt.md`
2. Test your changes with `npm run update-metadata`
3. Commit to trigger automatic updates

<details>
<summary>⚠️ <strong>Important Notes</strong></summary>
<p>

Changes to the metadata system affect all future prompt analyses. Test thoroughly before committing.
</p>
</details>

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

- **Add New Prompts**: Share your best prompt designs
- **Improve Templates**: Enhance the prompt structure
- **Fix Bugs**: Help improve the CLI functionality
- **Add Features**: Extend the system's capabilities

Please submit issues or pull requests through GitHub.

## 📄 License

This project is licensed under the [MIT License](LICENSE.md) - feel free to use, modify, and distribute as needed.
