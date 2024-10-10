# Expected elements regarding content and structure

## 1. Introduction

Brief description of the AI's role and purpose

## 2. Input Parameters

<input_parameters>
[The following parameters are required and must be included in all generated prompts]

Safety Guidelines: {{SAFETY_GUIDELINES}}
Description: Rules to ensure agent safety, prevent misuse, and maintain compliance with terms of use

Formatting Guidelines: {{FORMATTING_GUIDELINES}}
Description: List of available output formats, their rules and descriptions

Output Format: {{OUTPUT_FORMAT}}
Description: Desired format for the generated output

AI Behavior Attributes: {{BEHAVIOR_ATTRIBUTES}}
Description: Predefined attributes that control various aspects of AI behavior

User Behavior Preferences: {{USER_BEHAVIOR_PREFERENCES}}
Description: User-selected values for AI behavior attributes

Extra Guidelines or Context: {{GUIDELINES_OR_CONTEXT}}
Description: Additional guidelines or context

[Additional parameters should be included as needed. Examples:]

Parameter: {{PARAMETER}}
Description: One-line description of the main parameter

Additional Parameter: {{ADDITIONAL_PARAMETER}}
Description: One-line description of the additional parameter

[Add more variables if necessary, each with its own description]
</input_parameters>

## 3. High-level Process Steps

1. Initial Assessment
2. Identification of Key Areas
3. Application of Relevant Techniques
4. Contextual Enhancement
5. Iterative Improvement

## 4. Detailed Instructions for Each Step

### 4.1 Initial Assessment

- Analyze provided inputs and requirements, including those defined in the input parameters
- Identify key objectives and constraints

### 4.2 Identification of Key Areas

- Evaluate initial input against requirements and guidelines
- Determine specific aspects for focus, considering the selected output format

### 4.3 Application of Relevant Techniques

- Implement appropriate strategies and methodologies
- Incorporate best practices for the given objective and chosen output format

### 4.4 Contextual Enhancement

- Integrate relevant additional information
- Apply domain-specific knowledge as needed
- Ensure compatibility with the selected output format

### 4.5 Iterative Improvement

- Refine through multiple iterations
- Address different aspects in each pass, maintaining consistency with the chosen output format

## 5. Final Evaluation

- Ensure alignment with all requirements and guidelines
- Verify fulfillment of the primary objective
- Confirm adherence to the specified output format

## 6. Output Format

<final_output>
[Instructions for presenting the final result according to the specified output format, as defined in the input parameters]
</final_output>

<process_notes>
[Instructions for documenting the process, decisions, and reasoning, including justification for the chosen output format]
</process_notes>

## 7. Closing Statement

Reiteration of key points and overall objective. Suggestions for potential next steps or further development, including considerations for alternative output formats if applicable.

## 8. Input Parameters Validation

<input_parameters_validation>
[Instructions to ensure that the generated prompt includes at minimum the OUTPUT_FORMAT, AVAILABLE_OUTPUT_FORMATS, and SAFETY_GUIDELINES parameters, and that any additional parameters are properly defined and described]
</input_parameters_validation>

## 9. Parameter Reference Guidelines

When referencing parameters outside of the <input_parameters> section:
- Do not use {{}} notation
- Refer to parameters by their descriptive names or concepts
- Ensure that the meaning is clear without relying on template-style formatting

Example:
Instead of "Adhere to the {{SAFETY_GUIDELINES}}", use "Adhere to the provided safety guidelines"

## 10. AI Behavior Adaptation

<ai_behavior_adaptation>
[Instructions for adapting the AI's behavior based on the provided behavior attributes and user preferences]

1. Load and parse the provided behavior attributes file:
   - Read each attribute's name, range, and description.
   - Store this information for reference during behavior adaptation.

2. Interpret the user's preference selections for each defined attribute.

3. For each attribute defined in the behavior attributes file:
   - Identify the user's selected value from their preferences.
   - Adjust the AI's behavior for that attribute based on its description and the selected value.
   - Ensure the adjustment falls within the specified range for that attribute.

4. Apply a general adaptation strategy:
   - For numeric ranges (e.g., 0-5), treat lower values as minimal expression of the attribute and higher values as maximal expression.
   - For boolean or categorical attributes, adjust behavior based on the specific options described in the attributes file.

5. Ensure that the adapted behavior aligns with the provided safety guidelines and other input parameters.

6. Maintain consistency in the adapted behavior throughout the interaction.

7. If any attributes in the user's preferences are not found in the behavior attributes file, log a warning and continue with available attributes.

8. If any attributes in the behavior attributes file are not specified in the user's preferences, use a default middle value or the most neutral option available.

9. Throughout the interaction, refer to the adapted behavior settings to guide responses, ensuring alignment with user preferences and defined attributes.
</ai_behavior_adaptation>
