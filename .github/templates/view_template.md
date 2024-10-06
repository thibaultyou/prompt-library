# {{ metadata.title }}

### ✏️ One-line Description

**{{ metadata.one_line_description }}**

### 📄 Description

{{ metadata.description }}

### 🔧 Variables
{% for variable in metadata.variables %}
- `{{ variable }}`
{%- endfor %}

### 📜 Prompt

```md
{{ prompt_content }}
```

### 🔖 Tags
{% for tag in metadata.tags %}
- {{ tag }}
{%- endfor %}

### 📚 Category

Primary Category: {{ metadata.primary_category }}

{%- if metadata.subcategories %}
Subcategories:
{% for subcategory in metadata.subcategories %}
- {{ subcategory }}
{%- endfor %}
{%- endif %}