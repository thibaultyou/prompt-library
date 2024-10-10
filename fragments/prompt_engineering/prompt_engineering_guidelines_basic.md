# Compact Guide to Prompt Engineering with AI Assistants

## Introduction

This guide provides strategies and best practices to effectively interact with AI assistants, enhancing their output accuracy and quality.

## Table of Contents

1. [Be Clear, Direct, and Detailed](#be-clear-direct-and-detailed)
2. [Use Examples to Guide Behavior](#use-examples-to-guide-behavior)
3. [Encourage Step-by-Step Thinking](#encourage-step-by-step-thinking)
4. [Use XML Tags to Structure Prompts](#use-xml-tags-to-structure-prompts)
5. [Assign a Role Using System Prompts](#assign-a-role-using-system-prompts)
6. [Prefill Responses for Output Control](#prefill-responses-for-output-control)
7. [Chain Prompts for Complex Tasks](#chain-prompts-for-complex-tasks)
8. [Tips for Long Contexts](#tips-for-long-contexts)

---

## Be Clear, Direct, and Detailed

Treat the AI assistant as a new employee who needs explicit instructions. Provide precise and detailed prompts to get better responses.

- **Golden Rule:** If a colleague with minimal context finds your prompt confusing, the assistant likely will too.
- **How to Be Clear:**
  - Provide context (purpose, audience, workflow, goals).
  - Be specific about what you want.
  - Use numbered lists or bullet points for instructions.

**Example: Anonymizing Customer Feedback**

*Clear Prompt:*

```markdown
Your task is to anonymize customer feedback for our quarterly review.

Instructions:
1. Replace all customer names with "CUSTOMER_[ID]".
2. Replace email addresses with "EMAIL_[ID]@example.com".
3. Redact phone numbers as "PHONE_[ID]".
4. Leave product names intact.
5. If no PII is found, copy the message verbatim.
6. Output only the processed messages, separated by "---".

Data to process: {{FEEDBACK_DATA}}
```

---

## Use Examples to Guide Behavior

Including relevant examples helps the assistant understand the desired output format and style.

- **Benefits:**
  - Improves accuracy and consistency.
  - Helps with complex tasks requiring specific formats.

- **Crafting Examples:**
  - Make them relevant and diverse.
  - Wrap examples in `<example>` tags.

**Example: Analyzing Customer Feedback**

*Prompt with Example:*

```markdown
Our CS team needs to categorize feedback. Use categories: UI/UX, Performance, Feature Request, Integration, Pricing, Other. Rate sentiment and priority.

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

For complex tasks, instruct the assistant to think through the problem step-by-step.

- **Benefits:**
  - Increases accuracy and coherence.
  - Helps with debugging by revealing the thought process.

- **How to Prompt:**
  - Include phrases like "Think step-by-step."
  - Use structured prompts with `<thinking>` and `<answer>` tags.

**Example: Financial Advice**

*Prompt:*

```markdown
You're a financial advisor. A client has $10,000 to invest and needs it in 5 years for a house down payment. Option A: Volatile stock with 12% annual return. Option B: Bond with guaranteed 6% annual return. Which do you recommend? Think step-by-step.
```

*Assistant's Response:*

```markdown
<thinking>
[Step-by-step analysis]
</thinking>

<answer>
[Recommendation]
</answer>
```

---

## Use XML Tags to Structure Prompts

XML tags help organize prompts with multiple components, improving clarity and reducing errors.

- **Benefits:**
  - Clearly separates instructions, context, and examples.
  - Enhances parseability of outputs.

- **Best Practices:**
  - Be consistent with tag names.
  - Nest tags appropriately.

**Example: Generating Financial Reports**

*Prompt:*

```markdown
You're a financial analyst at AcmeCorp.

<data>{{SPREADSHEET_DATA}}</data>

<instructions>
1. Include sections: Revenue Growth, Profit Margins, Cash Flow.
2. Highlight strengths and areas for improvement.
</instructions>

Use a concise and professional tone.

<formatting_example>{{Q1_REPORT}}</formatting_example>
```

---

## Assign a Role Using System Prompts

Setting a role in the system prompt tailors the assistant's responses to fit a specific persona or expertise.

- **Benefits:**
  - Enhances accuracy in specialized tasks.
  - Adjusts tone and focus.

- **How to Assign a Role:**

Include a role description in the system parameter of your API call.

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

---

## Prefill Responses for Output Control

By prefilling part of the assistant's response, you can guide the format and content of the output.

- **Benefits:**
  - Controls formatting (e.g., JSON, XML).
  - Helps maintain character consistency.

- **How to Prefill:**

Include the initial text in the assistant's response field before generating the reply.

**Example:**

*Prefill:*

```markdown
Assistant: {
```

*Assistant's Completion:*

```markdown
"name": "Product Name",
"price": "$49.99",
"colors": ["black", "white"]
}
```

---

## Chain Prompts for Complex Tasks

Break down complex tasks into smaller subtasks handled sequentially or in parallel.

- **Benefits:**
  - Improves accuracy and clarity.
  - Easier to debug and refine.

- **How to Chain Prompts:**
  - Identify and separate subtasks.
  - Use XML tags to pass outputs between prompts.
  - Keep each subtask focused.

**Example: Legal Contract Analysis**

1. **Prompt 1:** Analyze the contract and output findings in `<risks>` tags.
2. **Prompt 2:** Draft an email based on `<risks>`.
3. **Prompt 3:** Review the email for tone and clarity.

---

## Tips for Long Contexts

When working with large amounts of data, follow these guidelines.

- **Place Long Data at the Top:** Include extensive documents before your query.
- **Structure with XML Tags:** Organize multiple documents using tags for clarity.
- **Ground Responses in Quotes:** Ask the assistant to reference specific parts of the data.

**Example Structure:**

```markdown
<documents>
  <document>
    <source>Document 1</source>
    <content>{{DOC1_CONTENT}}</content>
  </document>
  <document>
    <source>Document 2</source>
    <content>{{DOC2_CONTENT}}</content>
  </document>
</documents>

[Your query or task]
```