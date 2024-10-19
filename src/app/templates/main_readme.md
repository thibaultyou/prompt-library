# 🧠 Prompt Library

> 🚧 **Project Under Development** - Evolving project, expect changes. Feedback welcome!

Welcome to the **Prompt Library**, a collection of categorized AI prompts for easy navigation and reuse. This project combines GitHub Actions automation with a CLI for managing and using prompts, supporting both CI environments and desktop usage.

## 📚 Table of Contents

<!-- START doctoc -->
<!-- END doctoc -->

## 🎯 Purpose & Features

The Prompt Library treats AI prompts as mini-applications that instruct AI models to become specialized agents. This approach promotes modularity, reusability, and shareability across projects and teams. In the rapidly evolving AI landscape, maintaining a library of prompts and agent definitions is increasingly valuable for both individuals and organizations.

Key features include:

- Prompt storage and categorization
- Automatic metadata generation
- Easy navigation and reuse of prompts
- Collaboration and sharing capabilities
- Modular prompt components (fragments)
- CLI for prompt management and execution
- GitHub Actions for automation

> **Note**: Currently, this tool works exclusively with Claude from Anthropic. Support for additional AI models may be added in future updates.

This project serves as a starting point for creating your own AI toolkit, demonstrating one way to manage and utilize AI prompts and agent definitions in personal and professional contexts.

## ⚡ Quick Start

1. Fork and clone the repository
2. Set up Anthropic API key (GitHub Actions and CLI)
3. Install dependencies: `npm install`
4. Build and install CLI: `npm run build && npm install -g .`
5. Initialize CLI: `prompt-library-cli`

Detailed setup instructions in [Getting Started](#-getting-started).

## 🛠️ How It Works

1. Create a `prompt.md` file in `prompts` directory
2. Commit and push changes
3. GitHub Actions generate metadata and update READMEs
4. Use CLI to manage and execute prompts

> **Important**: Create and commit `prompt.md` files individually to allow GitHub Actions to generate corresponding `metadata.yml` files. Both files are required for CLI prompt usage.

## 🖥️ CLI Usage

### Interactive Menu

```sh
prompt-library-cli
```

For all CLI options, run:

```sh
prompt-library-cli --help
```

### List Prompts and Categories

```sh
prompt-library-cli prompts --list
prompt-library-cli prompts --categories
```

### Sync Personal Library

```sh
prompt-library-cli sync
```

> **Note**: Sync currently operates in read-only mode, fetching updates from the remote Git repository without pushing local changes.

### Execute Prompts

The `execute` command is a powerful tool for running prompts, especially useful in CI environments:

```sh
prompt-library-cli execute [options]
```

Key options:

- `-p, --prompt <id>`: Execute a stored prompt by ID
- `-i, --inspect`: Inspect the prompt variables without executing
- `-fi, --file-input <variable>=<file>`: Specify a file to use as input for a variable
- `-c, --ci`: Run in CI mode (non-interactive)

In CI mode, the `execute` command acts as a dynamic CLI, allowing you to pass prompt variables as command-line arguments:

```sh
prompt-library-cli execute -p <prompt_id> --<variable1> <value1> --<variable2> <value2> -c
```

For detailed usage, run:

```sh
prompt-library-cli execute --help
```

## 📂 Prompt Library Example

> **Note:** The prompts listed here are examples. Customize and maintain your own prompts as needed.
> **Tip:** Check out the Prompt Engineering category for prompts to help you create high-quality prompts and build your own library.

{%- for category, prompts in categories %}
<details>
<summary><strong>{{ format_string(category) }}</strong></summary>

{% for prompt in prompts %}
- [{{ prompt.title }}]({{ prompt.path }}) - {{ prompt.description }}
{%- endfor %}

</details>
{%- endfor %}

## 🚀 Getting Started

1. **Fork the Repository**: Click "Fork" to create a copy in your GitHub account.

2. **Clone Your Fork**:

   ```sh
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   ```

3. **Set Up Anthropic API Key**:
   - Generate an API key at the [Anthropic Console](https://console.anthropic.com/).
   - For GitHub Actions: Add as `ANTHROPIC_API_KEY` secret in repository settings.
   - For CLI: Enter when prompted or set as environment variable.

4. **Install Dependencies**:
   - Ensure [Node.js](https://nodejs.org/en) is installed.

   ```sh
   npm install
   ```

5. **Build and Install CLI**:

   ```sh
   npm run build
   npm install -g .
   ```

6. **Initialize CLI**:

   ```sh
   prompt-library-cli
   ```

   Follow prompts to set up configuration.

## 🧩 Using Fragments

Fragments are reusable prompt components:

1. Create `.md` files in `fragments` directory under the appropriate [categories](/src/app/system_prompts/prompt_analysis_agent/prompt.md)).
2. Reference in prompts: `{{FRAGMENT_NAME}}` (e.g., `{{AWESOME_GUIDELINES}}` for `awesome_guidelines.md`).
3. Manage and use via CLI.

## ⚙️ Metadata Customization

1. Edit `src/system_prompts/prompt_analysis_agent/prompt.md`.
2. Test with `npm run generate-metadata`.
3. Commit and push to trigger GitHub Actions.

> **Note**: Changes affect future metadata generations. Test thoroughly before committing.

## 🤝 Contributing

Contributions to improve templates, scripts, or structure are welcome! Submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.