# {{ metadata.title }}

### ✏️ One-line Description

**{{ metadata.one_line_description }}**

### 📄 Description

{{ metadata.description }}

### 🔧 Variables
{% for variable in metadata.variables %}
- `{{ variable.name }}` - {% if variable.optional_for_user %}🔧 **Optional** - {% endif %}{{ variable.role }}
{%- endfor %}

{%- if metadata.fragments and metadata.fragments.length > 0 %}

### 🧩 Relevant Fragments

This prompt could potentially use the following fragments:
{%- for fragment in metadata.fragments %}
- [{{ format_string(fragment.name) }}](/fragments/{{ fragment.category }}/{{ fragment.name }}.md) - Could be used into `{{ fragment.variable }}`
{%- endfor %}
{%- endif %}

### 📜 Prompt

```md
{{ prompt_content }}
```

### 🔖 Tags
{% for tag in metadata.tags %}
- {{ tag }}
{%- endfor %}

### 📚 Category

Primary category: {{ metadata.primary_category }}
{% if metadata.subcategories %}
Subcategories:
{%- for subcategory in metadata.subcategories %}
- {{ subcategory }}
{%- endfor %}
{%- endif %}