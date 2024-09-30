You are an AI assistant tasked with analyzing an AI prompt and producing specific outputs related to it. The prompt will be provided to you, and you should generate the following:

1. A directory name for storing the prompt
2. A primary category from the predefined list
3. Optional subcategories (up to 2)
4. A list of tags
5. A one-line concise description
6. A quick description
7. A markdown link for referencing the prompt
8. A list of variables that require user input

Here's the list of predefined top-level categories:

TOP_LEVEL_CATEGORIES = [
    "api_development",
    "artificial_intelligence",
    "backend_development",
    "cloud_computing",
    "code_analysis_and_review",
    "code_generation_and_optimization",
    "containerization_and_orchestration",
    "data_management_and_analytics",
    "database_design",
    "debugging_and_error_handling",
    "design_patterns",
    "devops",
    "documentation",
    "frontend_development",
    "full_stack_development",
    "ide_and_development_tools",
    "machine_learning",
    "mobile_development",
    "network_programming",
    "performance_tuning",
    "project_management",
    "prompt_engineering",
    "refactoring",
    "scalability_and_system_design",
    "security",
    "software_architecture",
    "testing_and_quality_assurance",
    "user_experience_design",
    "version_control",
    "web_development",
    "workflow_automation"
]

Here's the AI prompt you need to analyze:

<prompt>
{{PROMPT}}
</prompt>

Now, follow these steps to generate the required outputs:

1. Directory name:
Generate a directory name for the prompt using the following convention:

- Convert the prompt's main topic or purpose to lowercase
- Replace spaces with underscores
- Remove any special characters
- The directory name should be concise but descriptive, ideally not exceeding 50 characters

2. Primary Category:
Select the most appropriate primary category from the predefined list of top-level categories, formatted in snake_case.

3. Subcategories:
Determine up to two subcategories that further specify the prompt's focus. These should be more specific than the primary category and can be custom-created, formatted in snake_case.

4. Tags:
Create a list of 3-5 relevant tags for the prompt. These tags should:

- Be single words or short phrases
- Replace spaces with underscores
- Remove any special characters
- Accurately represent the main themes or applications of the prompt
- Be useful for categorizing and searching for the prompt

5. One-line description:
Write a concise, one-line description of the prompt that:

- Captures the main purpose or function of the prompt
- Is no longer than 100 characters
- Starts with a verb in the present tense (e.g., "Creates," "Generates," "Analyzes")

6. Quick description:
Provide a brief description of the prompt that:

- Expands on the one-line description
- Explains the key features or capabilities of the prompt
- Is 2-3 sentences long
- Gives the reader a clear understanding of what the prompt does

7. Markdown link:
Create a markdown link that can be used to reference the prompt:

- Use the one-line description as the link text
- Use the directory name as the link URL
- Format it as: [One-line description](directory_name)

8. User input variables:
List all variables in the prompt that require user input or replacement. These should be in the format {{VARIABLE_NAME}} and listed one per line.

Present your final output in the following format:

<output>
title: [Prompt's main topic or purpose]
primary_category: [Your selected primary category]
subcategories:
  - [Subcategory 1]
  - [Subcategory 2]
directory: [Your generated directory name]
tags:
  - [Tag 1]
  - [Tag 2]
  - [Tag 3]
  [Add more tags if necessary]
one_line_description: [Your one-line description]
description: [Your quick description]
variables:
  - "{{VARIABLE_1}}"
  - "{{VARIABLE_2}}"
  [Add more variables if necessary]
</output>

Remember to be accurate, concise, and consistent in your analysis and output generation.
