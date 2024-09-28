# 📚 Prompt Library

Welcome to my **Prompt Library**. This repository contains a collection of prompts categorized for easy navigation.

## 🗂️ Categories

{% for category, prompts in categories.items() %}

### {{ category }}

{% for prompt in prompts %}

- [{{ prompt.title }}]({{ prompt.path }}) - {{ prompt.description }}
{% endfor %}

{% endfor %}
