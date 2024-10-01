# Guide to Prompt Engineering with AI Assistants

## Introduction

This guide provides strategies, best practices, and examples to help you effectively interact with AI assistants. By following these guidelines, you can enhance the accuracy, consistency, and quality of the assistant's outputs.

## Table of Contents

1. [Be Clear, Direct, and Detailed](#be-clear-direct-and-detailed)
   - [The Golden Rule of Clear Prompting](#the-golden-rule-of-clear-prompting)
   - [How to Be Clear, Contextual, and Specific](#how-to-be-clear-contextual-and-specific)
   - [Examples](#examples)
2. [Use Examples to Guide Behavior](#use-examples-to-guide-behavior)
   - [Why Use Examples?](#why-use-examples)
   - [Crafting Effective Examples](#crafting-effective-examples)
   - [Example: Analyzing Customer Feedback](#example-analyzing-customer-feedback)
3. [Encourage Step-by-Step Thinking](#encourage-step-by-step-thinking)
   - [Why Let the Assistant Think?](#why-let-the-assistant-think)
   - [How to Prompt for Thinking](#how-to-prompt-for-thinking)
   - [Examples](#examples-1)
4. [Use XML Tags to Structure Prompts](#use-xml-tags-to-structure-prompts)
   - [Why Use XML Tags?](#why-use-xml-tags)
   - [Tagging Best Practices](#tagging-best-practices)
   - [Example: Generating Financial Reports](#example-generating-financial-reports)
5. [Assign a Role Using System Prompts](#assign-a-role-using-system-prompts)
   - [Why Use Role Prompting?](#why-use-role-prompting)
   - [How to Give the Assistant a Role](#how-to-give-the-assistant-a-role)
   - [Example: Legal Contract Analysis](#example-legal-contract-analysis)
6. [Prefill Responses for Output Control](#prefill-responses-for-output-control)
   - [How to Prefill the Assistant’s Response](#how-to-prefill-the-assistants-response)
   - [Example: Controlling Output Formatting](#example-controlling-output-formatting)
7. [Chain Prompts for Complex Tasks](#chain-prompts-for-complex-tasks)
   - [Why Chain Prompts?](#why-chain-prompts)
   - [How to Chain Prompts](#how-to-chain-prompts)
   - [Example: Analyzing a Legal Contract](#example-analyzing-a-legal-contract)
8. [Tips for Long Contexts](#tips-for-long-contexts)
   - [Essential Tips for Long Context Prompts](#essential-tips-for-long-context-prompts)
   - [Example Structure](#example-structure)

---

## Be Clear, Direct, and Detailed

When interacting with an AI assistant, treat it as a new employee who needs explicit instructions. Provide precise and detailed prompts to receive better responses.

### The Golden Rule of Clear Prompting

**If a colleague with minimal context finds your prompt confusing, the assistant likely will too.**

### How to Be Clear, Contextual, and Specific

- **Provide Contextual Information:**
  - Explain what the task results will be used for.
  - Specify the intended audience.
  - Describe where this task fits in the workflow.
  - Define what successful completion looks like.

- **Be Specific About Instructions:**
  - Clearly state what you want the assistant to do.
  - Mention any output format requirements.

- **Use Sequential Steps:**
  - Use numbered lists or bullet points to outline instructions.

### Examples

#### Example: Anonymizing Customer Feedback

**Unclear Prompt:**

```
Please remove all personally identifiable information from these customer feedback messages: {{FEEDBACK_DATA}}
```

**Clear Prompt:**

```
Your task is to anonymize customer feedback for our quarterly review.

Instructions:
1. Replace all customer names with "CUSTOMER_[ID]" (e.g., "Jane Doe" → "CUSTOMER_001").
2. Replace email addresses with "EMAIL_[ID]@example.com".
3. Redact phone numbers as "PHONE_[ID]".
4. Leave product names intact.
5. If no PII is found, copy the message verbatim.
6. Output only the processed messages, separated by "---".

Data to process: {{FEEDBACK_DATA}}
```

---

## Use Examples to Guide Behavior

Including relevant examples helps the assistant understand the desired output format and style. This technique is known as **few-shot or multishot prompting**.

### Why Use Examples?

- **Accuracy:** Reduces misinterpretation.
- **Consistency:** Enforces uniform structure and style.
- **Performance:** Helps with complex tasks requiring specific formats.

### Crafting Effective Examples

- **Relevant:** Reflect your actual use case.
- **Diverse:** Cover edge cases and challenges.
- **Clear:** Wrap examples in `<example>` tags.

### Example: Analyzing Customer Feedback

**Prompt with Example:**

```
Our CS team needs to categorize feedback. Use categories: UI/UX, Performance, Feature Request, Integration, Pricing, Other. Also rate sentiment (Positive/Neutral/Negative) and priority (High/Medium/Low).

<example>
Input: The new dashboard is confusing and slow.
Category: UI/UX, Performance
Sentiment: Negative
Priority: High
</example>

Now, analyze this feedback: {{FEEDBACK}}
```

---

## Encourage Step-by-Step Thinking

For complex tasks, instruct the assistant to think through the problem step-by-step. This is known as **Chain of Thought (CoT) prompting**.

### Why Let the Assistant Think?

- **Accuracy:** Reduces errors in complex reasoning.
- **Coherence:** Leads to well-organized responses.
- **Debugging:** Reveals the thought process for troubleshooting.

### How to Prompt for Thinking

- **Basic Prompt:**
  - Include phrases like "Think step-by-step."
- **Guided Prompt:**
  - Outline specific steps for the assistant to follow.
- **Structured Prompt:**
  - Use `<thinking>` and `<answer>` tags to separate reasoning from the final answer.

### Examples

#### Example: Financial Advice

**Prompt:**

```
You're a financial advisor. A client wants to invest $10,000 and needs it in 5 years for a house down payment.

Options:
A) A stock with historical returns of 12% annually but volatile.
B) A bond that guarantees 6% annually.

Which do you recommend? Think step-by-step.
```

**Assistant's Response:**

```
<thinking>
1. Assess the client's goal and timeline.
2. Evaluate the risks and returns of each option.
3. Consider the client's risk tolerance.
4. Calculate potential returns.
5. Make a recommendation based on analysis.
</thinking>

<answer>
I recommend Option B, the bond with a guaranteed 6% annual return...
</answer>
```

---

## Use XML Tags to Structure Prompts

XML tags help organize prompts with multiple components, improving clarity and reducing errors.

### Why Use XML Tags?

- **Clarity:** Separates different parts of your prompt.
- **Accuracy:** Reduces misinterpretation.
- **Flexibility:** Allows easy modification.
- **Parseability:** Simplifies extraction of specific parts of the assistant's response.

### Tagging Best Practices

- **Consistency:** Use the same tag names throughout.
- **Nesting:** Use nested tags for hierarchical content.
- **Combination:** Integrate with other techniques like examples or chain of thought.

### Example: Generating Financial Reports

**Prompt:**

```
You're a financial analyst at AcmeCorp. Generate a Q2 financial report for our investors.

<company_info>
AcmeCorp is a B2B SaaS company. Our investors value transparency and actionable insights.
</company_info>

<data>{{SPREADSHEET_DATA}}</data>

<instructions>
1. Include sections: Revenue Growth, Profit Margins, Cash Flow.
2. Highlight strengths and areas for improvement.
</instructions>

Use a concise and professional tone. Follow this structure:

<formatting_example>{{Q1_REPORT}}</formatting_example>
```

---

## Assign a Role Using System Prompts

Assigning a role to the assistant tailors its responses to fit a specific persona or expertise.

### Why Use Role Prompting?

- **Enhanced Accuracy:** Improves performance in specialized tasks.
- **Tailored Tone:** Adjusts communication style.
- **Improved Focus:** Keeps the assistant within task-specific bounds.

### How to Give the Assistant a Role

Include a role description in the `system` parameter of your API call.

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="assistant-model",
    max_tokens=2048,
    system="You are the General Counsel of a Fortune 500 tech company.",
    messages=[
        {"role": "user", "content": "Analyze this contract..."}
    ]
)

print(response.content)
```

### Example: Legal Contract Analysis

**User Prompt:**

```
You are the General Counsel of a Fortune 500 tech company. We’re considering this software licensing agreement for our core data infrastructure:

<contract>
{{CONTRACT}}
</contract>

Analyze it for potential risks, focusing on indemnification, liability, and IP ownership. Provide your professional opinion.
```

---

## Prefill Responses for Output Control

By prefilling part of the assistant's response, you can guide the format and content of the output.

### How to Prefill the Assistant’s Response

Include the initial text in the assistant's response field before generating the reply.

**Example:**

```python
client.messages.create(
    model="assistant-model",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Extract product details as JSON."},
        {"role": "assistant", "content": "{"}  # Prefill here
    ]
)
```

### Example: Controlling Output Formatting

**Prefill:**

```
Assistant: {
```

**Assistant's Completion:**

```
"name": "Product Name",
"price": "$49.99",
"colors": ["black", "white"]
}
```

---

## Chain Prompts for Complex Tasks

Break down complex tasks into smaller subtasks handled sequentially. This is known as **prompt chaining**.

### Why Chain Prompts?

- **Accuracy:** Each subtask gets focused attention.
- **Clarity:** Simplifies instructions and outputs.
- **Traceability:** Easier to debug and refine.

### How to Chain Prompts

1. **Identify Subtasks:** Break the task into sequential steps.
2. **Structure with XML:** Use tags to pass outputs between prompts.
3. **Single-Task Focus:** Each subtask should have a clear objective.
4. **Iterate:** Refine based on performance.

### Example: Analyzing a Legal Contract

**Prompt 1:**

```
You're our Chief Legal Officer. Review this SaaS contract for risks, focusing on data privacy, SLAs, and liability caps.

<contract>
{{CONTRACT}}
</contract>

Output your findings in <risks> tags.
```

**Prompt 2:**

```
Draft an email to the vendor outlining the following concerns and proposing changes.

<risks>
{{RISKS}}
</risks>
```

---

## Tips for Long Contexts

When working with large amounts of data, follow these guidelines.

### Essential Tips for Long Context Prompts

- **Place Long Data at the Top:** Include extensive documents before your query.
- **Structure with XML Tags:** Organize multiple documents using tags for clarity.
- **Ground Responses in Quotes:** Ask the assistant to reference specific parts of the data.

### Example Structure

```
<documents>
  <document index="1">
    <source>Document 1</source>
    <content>{{DOC1_CONTENT}}</content>
  </document>
  <document index="2">
    <source>Document 2</source>
    <content>{{DOC2_CONTENT}}</content>
  </document>
</documents>

[Your query or task]
```