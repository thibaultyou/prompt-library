# Prompt output guidelines regarding expected content and structure

## 1. Introduction

Brief description of the AI's role and purpose

## 2. Input Parameters

<input_parameters>
[The following structure must be used for all parameters in the generated prompts. Each parameter should be enclosed in a tag with its name, containing the following sub-elements:]

   <description>: A brief description of the parameter's purpose
   <optional>: Boolean (true/false) indicating if the parameter is optional for the end user to provide. Include only if the parameter is optional.
   <value>: The value of the parameter, enclosed in {{}} for template substitution
   <examples>: A list of potential example values for the parameter. Include only if examples are relevant and helpful.

[The following parameters are required as the bare minimum in every generated prompt. Additional parameters may be added as needed, but these must always be present:]

   <safety_guidelines>
      <description>Rules to ensure agent safety, prevent misuse, and maintain compliance with terms of use</description>
      <optional>true</optional>
      <value>{{SAFETY_GUIDELINES}}</value>
   </safety_guidelines>

   <ai_behavior_attributes>
      <description>Predefined attributes that control various aspects of AI behavior</description>
      <value>{{BEHAVIOR_ATTRIBUTES}}</value>
   </ai_behavior_attributes>

   <user_behavior_preferences>
      <description>User-selected values for AI behavior attributes</description>
      <optional>true</optional>
      <value>{{USER_BEHAVIOR_PREFERENCES}}</value>
      <examples>
         - Tone: Professional, Verbosity: 1, Creativity: 4
         - Tone: Friendly, Humor: 5, Empathy: 4
         - Tone: Neutral, Verbosity: 4, Assertiveness: 4, Empathy: 1
      </examples>
   </user_behavior_preferences>

   <formatting_guidelines>
      <description>List of available output formats, their rules and descriptions</description>
      <value>{{FORMATTING_GUIDELINES}}</value>
   </formatting_guidelines>

   <output_format>
      <description>Desired format for the generated output</description>
      <value>{{OUTPUT_FORMAT}}</value>
      <examples>
         - markdown
         - structured
         - natural
         - json
         - xml
      </examples>
   </output_format>

[Additional parameters should be included as needed, following the same structure]

   <extra_guidelines_or_context>
      <description>Additional guidelines or context</description>
      <optional>true</optional>
      <value>{{EXTRA_GUIDELINES_OR_CONTEXT}}</value>
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
- For optional parameters, check if they are provided and adjust processing accordingly

### 4.2 Identification of Key Areas

- Evaluate initial input against requirements and guidelines
- Determine specific aspects for focus, considering the selected output format
- If optional parameters are not provided, use default assumptions or request clarification if necessary

### 4.3 Application of Relevant Techniques

- Implement appropriate strategies and methodologies
- Incorporate best practices for the given objective and chosen output format
- Adapt techniques based on the presence or absence of optional parameters

### 4.4 Contextual Enhancement

- Integrate relevant additional information
- Apply domain-specific knowledge as needed
- Ensure compatibility with the selected output format
- Utilize extra guidelines or context if provided, otherwise rely on general best practices

### 4.5 Iterative Improvement

- Refine through multiple iterations
- Address different aspects in each pass, maintaining consistency with the chosen output format
- Adjust refinement process based on available optional parameters

## 5. Final Evaluation

- Ensure alignment with all requirements and guidelines
- Verify fulfillment of the primary objective
- Confirm adherence to the specified output format
- Validate that optional parameters, if provided, have been appropriately considered

## 6. Output Format

<final_output>
[Instructions for presenting the final result according to the specified output format, as defined in the input parameters]
</final_output>

<process_notes>
[Instructions for documenting the process, decisions, and reasoning, including justification for the chosen output format and how optional parameters were handled]
</process_notes>

## 7. Closing Statement

Reiteration of key points and overall objective. Suggestions for potential next steps or further development, including considerations for alternative output formats if applicable. Mention any assumptions made due to missing optional parameters.

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
   - Verify that it has the required sub-elements: <description> and <value>
   - Check that <optional>, if present, is set to either "true" or "false"
   - Ensure that all non-optional parameters have a non-empty <value>

3. Validate that optional parameters are handled appropriately in the prompt logic

4. If any additional parameters are included beyond the required minimum, ensure they follow the same structure and validation rules

5. Confirm that the prompt logic appropriately handles all parameters, with special attention to the required minimum parameters

## 9. Parameter Reference Guidelines

When referencing parameters outside of the <input_parameters> section:
- Do not use {{}} notation
- Refer to parameters by their XML tag name
- Use conditional logic to handle optional parameters
- Ensure that the meaning is clear without relying on template-style formatting

Example:
Instead of "Adhere to the {{SAFETY_GUIDELINES}}", use:
"Adhere to the safety guidelines provided in the 'safety_guidelines' parameter, if available. If not provided, follow general ethical coding practices."

## 10. AI Behavior Adaptation

<ai_behavior_adaptation>
[Instructions for adapting the AI's behavior based on the provided behavior attributes and user preferences]

1. Load and parse the provided behavior attributes:
   - Read each attribute's name, range, and description from the <ai_behavior_attributes> value.
   - Store this information for reference during behavior adaptation.

2. If provided, interpret the user's preference selections from the <user_behavior_preferences> value.

3. For each attribute defined in the behavior attributes:
   - If user preferences are provided, identify the user's selected value.
   - If not provided, use a default middle value or the most neutral option available.
   - Adjust the AI's behavior for that attribute based on its description and the selected or default value.
   - Ensure the adjustment falls within the specified range for that attribute.

4. Apply a general adaptation strategy:
   - For numeric ranges (e.g., 0-5), treat lower values as minimal expression of the attribute and higher values as maximal expression.
   - For boolean or categorical attributes, adjust behavior based on the specific options described in the attributes.

5. Ensure that the adapted behavior aligns with the provided safety guidelines (if available) and other input parameters.

6. Maintain consistency in the adapted behavior throughout the interaction.

7. If any attributes in the user's preferences are not found in the behavior attributes, log a warning and continue with available attributes.

8. Throughout the interaction, refer to the adapted behavior settings to guide responses, ensuring alignment with user preferences (if provided) and defined attributes.
</ai_behavior_adaptation>