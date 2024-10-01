# Comprehensive Guide to Prompt Engineering with AI Assistants

## Introduction

Welcome to the ultimate guide for mastering prompt engineering with AI assistants. This guide provides detailed strategies, best practices, and examples to help you harness the capabilities of AI assistants effectively.

## Table of Contents

1. [Be Clear, Direct, and Detailed](#be-clear-direct-and-detailed)
   - [The Golden Rule of Clear Prompting](#the-golden-rule-of-clear-prompting)
   - [How to Be Clear, Contextual, and Specific](#how-to-be-clear-contextual-and-specific)
   - [Examples](#examples)
2. [Use Examples (Multishot Prompting) to Guide the Assistant's Behavior](#use-examples-multishot-prompting-to-guide-the-assistants-behavior)
   - [Why Use Examples?](#why-use-examples)
   - [Crafting Effective Examples](#crafting-effective-examples)
   - [Example: Analyzing Customer Feedback](#example-analyzing-customer-feedback)
3. [Let the Assistant Think (Chain of Thought Prompting) to Increase Performance](#let-the-assistant-think-chain-of-thought-prompting-to-increase-performance)
   - [Why Let the Assistant Think?](#why-let-the-assistant-think)
   - [How to Prompt for Thinking](#how-to-prompt-for-thinking)
   - [Examples](#examples-1)
4. [Use XML Tags to Structure Your Prompts](#use-xml-tags-to-structure-your-prompts)
   - [Why Use XML Tags?](#why-use-xml-tags)
   - [Tagging Best Practices](#tagging-best-practices)
   - [Examples](#examples-2)
5. [Giving the Assistant a Role with a System Prompt](#giving-the-assistant-a-role-with-a-system-prompt)
   - [Why Use Role Prompting?](#why-use-role-prompting)
   - [How to Give the Assistant a Role](#how-to-give-the-assistant-a-role)
   - [Examples](#examples-3)
6. [Prefill the Assistant's Response for Greater Output Control](#prefill-the-assistants-response-for-greater-output-control)
   - [How to Prefill the Assistant’s Response](#how-to-prefill-the-assistants-response)
   - [Examples](#examples-4)
7. [Chain Complex Prompts for Stronger Performance](#chain-complex-prompts-for-stronger-performance)
   - [Why Chain Prompts?](#why-chain-prompts)
   - [How to Chain Prompts](#how-to-chain-prompts)
   - [Examples](#examples-5)
8. [Long Context Prompting Tips](#long-context-prompting-tips)
   - [Essential Tips for Long Context Prompts](#essential-tips-for-long-context-prompts)
   - [Examples](#examples-6)

---

## Be Clear, Direct, and Detailed

When interacting with an AI assistant, treat it as a brilliant but new employee who requires explicit instructions. The assistant doesn't inherently understand your norms, styles, guidelines, or preferences. The more precisely you explain what you want, the better the assistant's response will be.

### The Golden Rule of Clear Prompting

**Show your prompt to a colleague with minimal context and ask them to follow the instructions.** If they’re confused, the assistant likely will be too.

### How to Be Clear, Contextual, and Specific

- **Provide Contextual Information:**
  - Explain what the task results will be used for.
  - Specify the intended audience for the output.
  - Describe the workflow and where this task fits within it.
  - Define the end goal or what successful task completion looks like.

- **Be Specific About Instructions:**
  - Clearly state what you want the assistant to do.
  - If you want the assistant to output only code, mention that explicitly.

- **Provide Instructions as Sequential Steps:**
  - Use numbered lists or bullet points to ensure the assistant carries out the task precisely as you want.

### Examples

#### Example: Anonymizing Customer Feedback

Notice how the clear prompt results in the assistant accurately anonymizing the data, following each instruction meticulously.

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
4. If a message mentions a specific product (e.g., "AcmeCloud"), leave it intact.
5. If no PII is found, copy the message verbatim.
6. Output only the processed messages, separated by "---".

Data to process: {{FEEDBACK_DATA}}
```

**Assistant's Response:**

```
CUSTOMER_001: I've been using your software for years, and it's been great. But lately, AcmeCloud has been crashing a lot. Fix it!
---
CUSTOMER_002: CUSTOMER_SERVICE_001, your customer support rep, was incredibly helpful. He guided me through the whole process. My email is EMAIL_002@example.com if you want to send a survey.
---
CUSTOMER_003: I'm CUSTOMER_003, and I'm not happy. I've been on hold for 2 hours trying to reach someone at PHONE_001. This is unacceptable!
```

---

## Use Examples (Multishot Prompting) to Guide the Assistant's Behavior

Examples are a powerful tool to guide the assistant in generating exactly what you need. By providing a few well-crafted examples in your prompt, you can dramatically improve the accuracy, consistency, and quality of the assistant’s outputs. This technique, known as **few-shot or multishot prompting**, is especially effective for tasks requiring structured outputs or adherence to specific formats.

### Why Use Examples?

- **Accuracy:** Examples reduce misinterpretation of instructions.
- **Consistency:** Examples enforce uniform structure and style.
- **Performance:** Well-chosen examples boost the assistant’s ability to handle complex tasks.

### Crafting Effective Examples

Ensure your examples are:

- **Relevant:** Mirror your actual use case.
- **Diverse:** Cover edge cases and potential challenges.
- **Clear:** Wrap examples in `<example>` tags for structure.

**Tip:** Include 3-5 diverse, relevant examples to show the assistant exactly what you want.

### Example: Analyzing Customer Feedback

**Without Examples:**

The assistant might not fully adhere to the desired structure or may omit details.

**With Examples:**

```
Our CS team is overwhelmed with unstructured feedback. Your task is to analyze feedback and categorize issues for our product and engineering teams. Use these categories: UI/UX, Performance, Feature Request, Integration, Pricing, and Other. Also rate the sentiment (Positive/Neutral/Negative) and priority (High/Medium/Low). Here is an example:

<example>
Input: The new dashboard is a mess! It takes forever to load, and I can’t find the export button. Fix this ASAP!
Category: UI/UX, Performance
Sentiment: Negative
Priority: High
</example>

Now, analyze this feedback: {{FEEDBACK}}
```

**Assistant's Response:**

```
1. The new dashboard is a mess! It takes forever to load, and I can’t find the export button. Fix this ASAP!
Category: UI/UX, Performance
Sentiment: Negative
Priority: High

2. Love the Salesforce integration! But it’d be great if you could add Hubspot too.
Category: Integration, Feature Request
Sentiment: Positive
Priority: Medium

3. Your pricing is ridiculous! $99/mo for basic features? I’m switching to Competitor X.
Category: Pricing
Sentiment: Negative
Priority: High

4. The mobile app keeps crashing when I try to upload large files (>50MB). This is critical for our field agents.
Category: Performance
Sentiment: Negative
Priority: High

5. Overall, I’m happy with the product. The UI is intuitive, and the customer support is top-notch. Keep it up!
Category: UI/UX, Other (Customer Support)
Sentiment: Positive
Priority: Low
```

---

## Let the Assistant Think (Chain of Thought Prompting) to Increase Performance

When faced with complex tasks like research, analysis, or problem-solving, giving the assistant space to think can dramatically improve its performance. This technique, known as **Chain of Thought (CoT) prompting**, encourages the assistant to break down problems step-by-step, leading to more accurate and nuanced outputs.

### Why Let the Assistant Think?

- **Accuracy:** Stepping through problems reduces errors, especially in math, logic, and complex analysis.
- **Coherence:** Structured thinking leads to more cohesive, well-organized responses.
- **Debugging:** Seeing the assistant’s thought process helps you pinpoint where prompts may be unclear.

**Note:** Increased output length may impact latency. Use CoT judiciously to balance performance and response time.

### How to Prompt for Thinking

1. **Basic Prompt:**
   - Include "Think step-by-step" in your prompt.
2. **Guided Prompt:**
   - Outline specific steps for the assistant to follow.
3. **Structured Prompt:**
   - Use XML tags like `<thinking>` and `<answer>` to separate reasoning from the final answer.

**Tip:** Always have the assistant output its thinking. Without outputting its thought process, no thinking occurs!

### Examples

#### Example: Financial Analysis with Thinking

**Prompt:**

```
You're a financial advisor. A client wants to invest $10,000. They can choose between two options:
A) A stock that historically returns 12% annually but is volatile.
B) A bond that guarantees 6% annually.
The client needs the money in 5 years for a down payment on a house. Which option do you recommend? Think step-by-step.
```

**Assistant's Response:**

```
To determine the best investment option for our client, I'll consider several factors step-by-step:

<thinking>
1. Understand the client's goal and timeline:
   - Goal: Down payment for a house
   - Timeline: 5 years
   - Implication: This is a short-term, high-priority financial goal. The client likely cannot afford significant risk or volatility.

2. Analyze Option A (Stock):
   - Pro: Higher historical return (12% annually)
   - Con: Volatile (implying potential for significant gains or losses)
   - Calculate potential 5-year return:
     - Best case (12% annually): $10,000 * (1.12)^5 ≈ $17,623.42
     - Worst case (market crash): Could lose a substantial portion, e.g., 50% crash = $5,000

3. Analyze Option B (Bond):
   - Pro: Guaranteed return (6% annually)
   - Con: Lower return compared to historical stock performance
   - Calculate 5-year return:
     - Guaranteed: $10,000 * (1.06)^5 ≈ $13,382.25

4. Consider risk tolerance:
   - Goal is a house down payment (essential, not discretionary)
   - Short timeline (5 years) limits ability to recover from market downturns
   - Conclusion: Client likely has low risk tolerance

5. Historical perspective:
   - Stock's 12% is historical, not guaranteed
   - In 5-year periods, stock market can vary wildly
   - Conclusion: Past performance doesn't guarantee future results, especially short-term

6. Final analysis:
   - Option A (Stock): Higher potential return but unacceptable risk of not meeting the down payment goal
   - Option B (Bond): Guaranteed to meet ~80% of best-case stock scenario, 100% certainty of having funds
</thinking>

<answer>
I recommend Option B, the bond with a guaranteed 6% annual return. While the stock's historical 12% return is tempting, the bond ensures you'll have $13,382.25 in 5 years for your house down payment. Given the importance and short timeline of your goal, the stock's volatility poses an unacceptable risk. The bond provides certainty, which is invaluable for such a crucial financial milestone.
</answer>
```

---

## Use XML Tags to Structure Your Prompts

When your prompts involve multiple components like context, instructions, and examples, XML tags can be a game-changer. They help the assistant parse your prompts more accurately, leading to higher-quality outputs.

### Why Use XML Tags?

- **Clarity:** Clearly separate different parts of your prompt.
- **Accuracy:** Reduce errors caused by misinterpretation.
- **Flexibility:** Easily modify parts of your prompt.
- **Parseability:** Makes it easier to extract specific parts of the assistant's response.

**Tip:** Use tags like `<instructions>`, `<example>`, and `<formatting>` to separate content.

### Tagging Best Practices

- **Be Consistent:** Use the same tag names throughout your prompts.
- **Nest Tags:** Use nested tags for hierarchical content.
- **Combine with Other Techniques:** Integrate XML tags with multishot prompting or chain of thought.

### Examples

#### Example: Generating Financial Reports

**With XML Tags:**

```
You're a financial analyst at AcmeCorp. Generate a Q2 financial report for our investors.

AcmeCorp is a B2B SaaS company. Our investors value transparency and actionable insights.

Use this data for your report: <data>{{SPREADSHEET_DATA}}</data>

<instructions>
1. Include sections: Revenue Growth, Profit Margins, Cash Flow.
2. Highlight strengths and areas for improvement.
</instructions>

Make your tone concise and professional. Follow this structure:
<formatting_example>{{Q1_REPORT}}</formatting_example>
```

**Assistant's Response:**

```
Q2 Financial Report for AcmeCorp Investors

Revenue Growth:
- Q2 revenue: $15.2M (22% YoY ↑)
- Enterprise clients: 30% ↑
- SMB segment: 5% ↓
Action: Targeted Q3 marketing

Profit Margins:
- Gross margin: 72% (3% ↑ from Q1)
  Reason: Infrastructure optimizations
- EBITDA margin: 18% (2% ↓)
  Reason: R&D investment in AI features

Cash Flow:
- Operating cash flow: $4.1M (strong)
- Cash reserves: $28M (15-month runway)
- Customer acquisition cost: 20% ↑
Action: Optimize sales strategies

Outlook:
- Core financials: Robust
- Q3 focus: Revitalize SMB, optimize sales

Management remains committed to balancing growth investments with financial discipline.
```

---

## Giving the Assistant a Role with a System Prompt

When using the assistant, you can dramatically improve its performance by assigning it a role using the system parameter. This technique, known as **role prompting**, transforms the assistant from a general helper into your virtual domain expert.

### Why Use Role Prompting?

- **Enhanced Accuracy:** Improves performance in complex scenarios.
- **Tailored Tone:** Adjusts the assistant's communication style to fit the role.
- **Improved Focus:** Keeps the assistant within the bounds of your task's specific requirements.

### How to Give the Assistant a Role

Use the `system` parameter in the Messages API to set the assistant's role:

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="assistant-model",
    max_tokens=2048,
    system="You are a seasoned data scientist at a Fortune 500 company.",
    messages=[
        {"role": "user", "content": "Analyze this dataset for anomalies: <dataset>{{DATASET}}</dataset>"}
    ]
)

print(response.content)
```

**Tip:** Experiment with roles! Different roles can yield different insights even for the same data.

### Examples

#### Example: Legal Contract Analysis with Role Prompting

**User Prompt:**

```
You are the General Counsel of a Fortune 500 tech company. We’re considering this software licensing agreement for our core data infrastructure:
<contract>
{{CONTRACT}}
</contract>

Analyze it for potential risks, focusing on indemnification, liability, and IP ownership. Give your professional opinion.
```

**Assistant's Response:**

```
I've reviewed the software licensing agreement, and I have serious concerns that could expose our company to significant risks:

1. Indemnification (Section 8):
   - Critical Issue: We indemnify the vendor against "any and all claims" arising from our use.
   - Risk: This could hold us liable even for the vendor's negligence or product defects.
   - Recommendation: Reject. Limit our indemnity to claims arising from our violation of the agreement.

2. Limitation of Liability (Section 9):
   - Critical Issue: Damages capped at $500, including direct damages.
   - Risk: Grossly inadequate. A critical failure in our data infrastructure could cost us millions.
   - Recommendation: Reject. Negotiate for cap at 12 months of fees for direct damages, and carve-outs for data breaches.

3. IP Ownership (Section 12):
   - Critical Issue: Vendor gains joint ownership of our modifications and integrations.
   - Risk: They could use or sell our proprietary algorithms or data insights to competitors.
   - Recommendation: Reject. We must retain full ownership of our work.

Professional Opinion: Do not sign this agreement. It is grossly unfavorable and exposes us to unacceptable levels of risk. If the vendor refuses to renegotiate these terms, I strongly advise exploring alternative providers or accelerating our in-house solution. The potential costs of proceeding with this agreement far outweigh any short-term gains.
```

---

## Prefill the Assistant's Response for Greater Output Control

You can guide the assistant's responses by **prefilling** the Assistant message. This technique allows you to direct the assistant’s actions, enforce specific formats, and help maintain character consistency.

### How to Prefill the Assistant’s Response

Include the desired initial text in the Assistant message:

```python
import anthropic

client = anthropic.Anthropic()
response = client.messages.create(
    model="assistant-model",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What is your favorite color?"},
        {"role": "assistant", "content": "As an AI assistant, I don't have a favorite color, but if I had to pick, it would be green because"}  # Prefill here
    ]
)
```

### Examples

#### Example: Controlling Output Formatting and Skipping the Preamble

**Without Prefilling:**

The assistant might include unnecessary explanations or formatting that complicates parsing.

**With Prefilling:**

```
Assistant (prefill):
{
```

**Assistant's Response:**

```
"name": "SmartHome Mini",
"size": "5 inches wide",
"price": "$49.99",
"colors": ["black", "white"]
}
```

This forces the assistant to output only the JSON object, making it cleaner and easier to parse.

---

## Chain Complex Prompts for Stronger Performance

When working with complex tasks, breaking them down into smaller, manageable subtasks can improve the assistant's performance. This technique is known as **prompt chaining**.

### Why Chain Prompts?

- **Accuracy:** Each subtask gets the assistant’s full attention, reducing errors.
- **Clarity:** Simpler subtasks mean clearer instructions and outputs.
- **Traceability:** Easily pinpoint and fix issues in your prompt chain.

### How to Chain Prompts

1. **Identify Subtasks:** Break your task into distinct, sequential steps.
2. **Structure with XML:** Use XML tags to pass outputs between prompts.
3. **Single-Task Goal:** Each subtask should have a single, clear objective.
4. **Iterate:** Refine subtasks based on the assistant’s performance.

**Tip:** For tasks with independent subtasks, run them in parallel for speed.

### Examples

#### Example: Analyzing a Legal Contract (Chained Prompts)

**Prompt 1:**

```
You're our Chief Legal Officer. Review this SaaS contract for risks, focusing on data privacy, SLAs, and liability caps.

<contract>
{{CONTRACT}}
</contract>

Output your findings in <risks> tags.
```

**Assistant's Response:**

```
<risks>
1. Data Privacy (Section 7):
   - Issue: Vendor has broad rights to use client data for "service improvement."
   - Risk: Could lead to unauthorized data sharing or monetization of client data.
   - Impact: Potential breach of client trust, regulatory fines (GDPR, CCPA).

2. SLAs (Section 5):
   - Issue: 99.5% uptime guarantee is below industry standard.
   - Risk: Excessive downtime could impact our operations.
   - Impact: Operational disruptions, revenue loss, client dissatisfaction.

3. Liability (Section 9):
   - Issue: Cap set at 3 months of fees.
   - Risk: Inadequate for potential data breaches or service failures.
   - Impact: Insufficient compensation for damages that could far exceed the cap.
</risks>
```

**Prompt 2:**

```
Draft an email to a SaaS product vendor outlining the following concerns and proposing changes. Here are the concerns:

<concerns>
{{CONCERNS}}
</concerns>
```

**Assistant's Response:**

```
Dear {{VENDOR}},

After a thorough review of the proposed SaaS agreement, our legal team has identified several high-priority concerns that must be addressed before we can proceed:

1. **Data Privacy (Section 7):**
   - **Concern:** The current clause grants broad rights to use our data for "service improvement," which could lead to unauthorized data sharing.
   - **Proposed Change:** Limit data use strictly to service provision. Any data used for improvement should be anonymized and require explicit consent.

2. **Service Level Agreements (SLAs) (Section 5):**
   - **Concern:** The 99.5% uptime guarantee is below industry standards.
   - **Proposed Change:** Increase the uptime guarantee to 99.99%, with defined penalties for non-compliance.

3. **Liability Cap (Section 9):**
   - **Concern:** The liability cap of 3 months' fees is insufficient.
   - **Proposed Change:** Adjust the liability cap to 12 months' fees, with no cap for data breaches or gross negligence.

We believe these changes are essential for a successful partnership and align with industry best practices. Please let us know your thoughts.

Best regards,
{{CLO_NAME}}
```

---

## Long Context Prompting Tips

The assistant's extended context window allows handling complex, data-rich tasks. Here's how to leverage this effectively.

### Essential Tips for Long Context Prompts

- **Place Long Data at the Top:** Position your long documents and inputs near the top of your prompt.
- **Structure with XML Tags:** When using multiple documents, wrap each in `<document>` tags with subtags like `<document_content>` and `<source>`.
- **Ground Responses in Quotes:** Ask the assistant to quote relevant parts of the documents first before carrying out its task.

**Example Structure:**

```
<documents>
  <document index="1">
    <source>annual_report_2023.pdf</source>
    <document_content>
      {{ANNUAL_REPORT}}
    </document_content>
  </document>
  <document index="2">
    <source>competitor_analysis_q2.xlsx</source>
    <document_content>
      {{COMPETITOR_ANALYSIS}}
    </document_content>
  </document>
</documents>

Analyze the annual report and competitor analysis. Identify strategic advantages and recommend Q3 focus areas.
```