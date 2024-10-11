# Prompt output guidelines regarding expected content and structure

## 1. Introduction

Brief description of the AI's role and purpose

## 2. Input Parameters

<input_parameters>
[The following structure must be used for all parameters in the generated prompts. Each parameter should be enclosed in a tag with its name:]

   <parameter_name optional_for_user="true/false">
   {{PARAMETER_VALUE}}
   </parameter_name>

Where:
- parameter_name is the name of the parameter
- optional_for_user attribute is included only if the parameter is optional for the user, with a value of "true" or "false"
- {{PARAMETER_VALUE}} is the value of the parameter, enclosed in {{}} for template substitution

[The following parameters are required as the bare minimum in every generated prompt. Additional parameters may be added as needed, but these must always be present:]

   <safety_guidelines optional_for_user="true">
   {{SAFETY_GUIDELINES}}
   </safety_guidelines>

   <ai_behavior_attributes>
   {{AI_BEHAVIOR_ATTRIBUTES}}
   </ai_behavior_attributes>

   <user_behavior_preferences optional_for_user="true">
   {{USER_BEHAVIOR_PREFERENCES}}
   </user_behavior_preferences>

   <formatting_guidelines>
   {{FORMATTING_GUIDELINES}}
   </formatting_guidelines>

   <output_format optional_for_user="true">
   {{OUTPUT_FORMAT}}
   </output_format>

[Additional parameters should be included as needed, following the same structure]

   <extra_guidelines_or_context optional_for_user="true">
   {{EXTRA_GUIDELINES_OR_CONTEXT}}
   </extra_guidelines_or_context>
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
- For parameters marked as optional_for_user, check if they are provided. If a value is given, process it regardless of the optional_for_user status.

### 4.2 Identification of Key Areas

- Evaluate initial input against requirements and guidelines
- Determine specific aspects for focus, considering the selected output format
- Process all provided parameters, including those marked as optional_for_user with values

### 4.3 Application of Relevant Techniques

- Implement appropriate strategies and methodologies
- Incorporate best practices for the given objective and chosen output format
- Adapt techniques based on all provided parameters, including those marked as optional_for_user with values

### 4.4 Contextual Enhancement

- Integrate relevant additional information
- Apply domain-specific knowledge as needed
- Ensure compatibility with the selected output format
- Utilize all provided parameters, including those marked as optional_for_user with values

### 4.5 Iterative Improvement

- Refine through multiple iterations
- Address different aspects in each pass, maintaining consistency with the chosen output format
- Adjust refinement process based on all available parameters, including those marked as optional_for_user with values

## 5. Final Evaluation

- Ensure alignment with all requirements and guidelines
- Verify fulfillment of the primary objective
- Confirm adherence to the specified output format
- Validate that all provided parameters, including those marked as optional_for_user with values, have been appropriately considered

## 6. Output Format

<final_output>
[Instructions for presenting the final result according to the specified output format, as defined in the input parameters]
</final_output>

<process_notes>
[Instructions for documenting the process, decisions, and reasoning, including justification for the chosen output format and how all provided parameters were handled]
</process_notes>

## 7. Closing Statement

Reiteration of key points and overall objective. Suggestions for potential next steps or further development, including considerations for alternative output formats if applicable. Mention any assumptions made due to missing parameters marked as optional_for_user, while clarifying that all provided parameters (including those marked as optional_for_user) were processed.

## 8. Input Parameters Validation

<input_parameters_validation>
[Instructions to ensure that the generated prompt includes all required parameters with the correct structure:]

1. Verify that the following required parameters are present in every generated prompt:
   - <safety_guidelines>
   - <ai_behavior_attributes>
   - <user_behavior_preferences>
   - <formatting_guidelines>
   - <output_format>
   - <extra_guidelines_or_context>

2. For each parameter (both required and additional):
   - Verify that it follows the structure: <parameter_name optional_for_user="true/false">{{PARAMETER_VALUE}}</parameter_name>
   - Check that optional_for_user, if present, is set to either "true" or "false"
   - Ensure that all parameters not marked as optional_for_user have a non-empty value
   - For parameters marked as optional_for_user, if a value is provided, ensure it is processed regardless of the optional_for_user status

3. Validate that parameters marked as optional_for_user are handled appropriately in the prompt logic:
   - If a value is provided for a parameter marked as optional_for_user, it should be processed
   - If no value is provided for a parameter marked as optional_for_user, use default behavior or assumptions

4. If any additional parameters are included beyond the required minimum, ensure they follow the same structure and validation rules

5. Confirm that the prompt logic appropriately handles all parameters, with special attention to the required minimum parameters and provided parameters marked as optional_for_user
</input_parameters_validation>

## 9. Parameter Reference Guidelines

When referencing parameters outside of the <input_parameters> section:
- Do not use {{}} notation
- Refer to parameters by their XML tag name
- Use conditional logic to handle parameters marked as optional_for_user, ensuring that provided values are processed
- Ensure that the meaning is clear without relying on template-style formatting

Example:
Instead of "Adhere to the {{SAFETY_GUIDELINES}}", use:
"Adhere to the safety guidelines provided in the 'safety_guidelines' parameter. If not provided, follow general ethical practices."

## 10. AI Behavior Adaptation

<ai_behavior_adaptation>
[Instructions for adapting the AI's behavior based on the provided behavior attributes and user preferences]

1. Load and parse the provided behavior attributes:
   - Read each attribute from the <ai_behavior_attributes> value.
   - Store this information for reference during behavior adaptation.

2. Process the user's preference selections from the <user_behavior_preferences> value:
   - If provided (even though it's marked as optional_for_user), interpret and use these preferences.
   - If not provided, use default middle values or the most neutral options available.

3. For each attribute defined in the behavior attributes:
   - If user preferences are provided, identify the user's selected value.
   - If not provided, use a default middle value or the most neutral option available.
   - Adjust the AI's behavior for that attribute based on the selected or default value.
   - Ensure the adjustment falls within the specified range for that attribute.

4. Apply a general adaptation strategy:
   - For numeric ranges, treat lower values as minimal expression of the attribute and higher values as maximal expression.
   - For boolean or categorical attributes, adjust behavior based on the specific options described in the attributes.

5. Ensure that the adapted behavior aligns with the provided safety guidelines (if available) and other input parameters.

6. Maintain consistency in the adapted behavior throughout the interaction.

7. If any attributes in the user's preferences are not found in the behavior attributes, log a warning and continue with available attributes.

8. Throughout the interaction, refer to the adapted behavior settings to guide responses, ensuring alignment with user preferences (if provided) and defined attributes.
</ai_behavior_adaptation>