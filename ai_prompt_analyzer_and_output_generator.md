
# 🚀 AI Prompt Analyzer and Output Generator

### 🔖 Tags
- prompt_analysis
- output_generation
- markdown_formatting
- metadata_extraction

### ✏️ One-line Description
**Analyzes AI prompts and generates structured outputs with metadata and formatting**

### 📄 Description
This prompt analyzes AI prompts and generates structured outputs including a filename, tags, descriptions, markdown links, commit messages, and user input variables. It provides a comprehensive metadata package for organizing and referencing AI prompts.

### 🔧 Variables
- `{{PROMPT}}`

### 📜 Prompt

```md
You are an AI assistant tasked with analyzing an AI prompt and producing specific outputs related to it. The prompt will be provided to you, and you should generate the following:

1. A filename for storing the prompt as a markdown file
2. A list of tags
3. A one-line concise description
4. A quick description
5. A markdown link for referencing the prompt
6. A commit message for version control
7. A list of variables that require user input

Here's the AI prompt you need to analyze:

<prompt>
{{PROMPT}} 
</prompt>

Now, follow these steps to generate the required outputs:

1. Filename:
Generate a filename for the prompt using the following convention:
- Convert the prompt's main topic or purpose to lowercase
- Replace spaces with underscores
- Remove any special characters
- Add the .md extension
- The filename should be concise but descriptive, ideally not exceeding 50 characters

2. Tags:
Create a list of 3-5 relevant tags for the prompt. These tags should:
- Be single words or short phrases
- Replace spaces with underscores
- Remove any special characters
- Accurately represent the main themes or applications of the prompt
- Be useful for categorizing and searching for the prompt

3. One-line description:
Write a concise, one-line description of the prompt that:
- Captures the main purpose or function of the prompt
- Is no longer than 100 characters
- Starts with a verb in the present tense (e.g., "Creates," "Generates," "Analyzes")

4. Quick description:
Provide a brief description of the prompt that:
- Expands on the one-line description
- Explains the key features or capabilities of the prompt
- Is 2-3 sentences long
- Gives the reader a clear understanding of what the prompt does

5. Markdown link:
Create a markdown link that can be used to reference the prompt:
- Use the one-line description as the link text
- Use the filename as the link URL
- Format it as: [One-line description](filename)

6. Commit message:
Create a commit message for version control with the following format:
- Start with an emoji that relates to the content or purpose of the prompt
- Follow with a short, descriptive message about the addition or change
- Use present tense and imperative mood
- Keep it under 50 characters if possible
Example: "✨ Add AI prompt analyzer and output generator"

7. User input variables:
List all variables in the prompt that require user input or replacement. These should be in the format {{VARIABLE_NAME}} and listed one per line.

Present your final output in the following format:

<output>
# 🚀 [Prompt's main topic or purpose as title]

### 🔖 Tags:
- [Tag 1]
- [Tag 2]
- [Tag 3]
(Add more tags if necessary)

### ✏️ One-line Description
**[Your one-line description]**

### 📄 Description
[Your quick description]

### 🔧 Variables
- `{{VARIABLE_1}}`
- `{{VARIABLE_2}}`
(Add more variables if necessary)

---

## 📂 Additional Information

- **📝 Filename**: [Your generated filename]
- **🔗 Markdown Link**: [[Your one-line description]]([Your generated filename])
- **💬 Commit Message**: [Your commit message]

---

### 📜 Prompt

```md
[The provided prompt]
```
</output>

Remember to be accurate, concise, and consistent in your analysis and output generation.
```