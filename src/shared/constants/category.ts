/**
 * Category-related constants, primarily descriptions for standard prompt categories.
 */

/**
 * Descriptions for standard prompt categories used throughout the application.
 * The keys should match the category slugs (lowercase, snake_case).
 * These descriptions provide context in UI elements like menus and help text.
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    analysis: 'Prompts for data analysis, information extraction, and interpretation.',
    art_and_design: 'Prompts related to visual arts, graphic design, UI/UX, and aesthetics.',
    business: 'Prompts for business strategy, operations, management, finance, and marketing.',
    coding: 'Prompts for software development, programming languages, algorithms, and debugging.',
    communication:
        'Prompts focused on improving written and verbal communication skills, messaging, and interpersonal interactions.',
    content_creation: 'Prompts for generating written content, documentation, scripts, and creative pieces.',
    creative: 'Prompts for fostering creativity across various mediums like writing, art, music, etc.',
    customer_service: 'Prompts designed for customer support scenarios, handling inquiries, and client communication.',
    data_processing: 'Prompts for data manipulation, transformation, cleaning, and visualization tasks.',
    education: 'Prompts related to teaching, learning, explaining concepts, and knowledge sharing.',
    entertainment: 'Prompts for generating recreational content, game ideas, stories, and media interaction.',
    finance: 'Prompts dealing with personal finance, investment, budgeting, and financial analysis (use with caution).',
    gaming: 'Prompts specific to game design, gameplay strategies, character creation, and gaming content.',
    healthcare:
        'Prompts related to health, wellness, fitness, and explaining medical concepts (informational only, not medical advice).',
    language: 'Prompts for language learning, translation, linguistics, grammar, and style.',
    legal: 'Prompts related to understanding legal concepts, drafting clauses, or summarizing legal text (informational only, not legal advice).',
    marketing: 'Prompts for advertising, promotion, branding, market research, and campaign ideas.',
    music: 'Prompts for music composition, theory, production techniques, and lyric generation.',
    personal_assistant:
        'Prompts designed to act as a personal assistant for scheduling, reminders, and task management.',
    personal_growth: 'Prompts focused on self-improvement, skill development, goal setting, and life coaching.',
    problem_solving: 'Prompts providing frameworks or assistance for general problem analysis and solution generation.',
    productivity:
        'Prompts aimed at improving efficiency, workflow optimization, time management, and task prioritization.',
    prompt_engineering: 'Prompts specifically designed to help create, analyze, refine, or optimize other AI prompts.',
    research: 'Prompts to assist with academic or professional research, literature reviews, and data gathering.',
    science: 'Prompts related to scientific concepts, methodology, explaining theories, and experiment design.',
    social_media:
        'Prompts for creating content, planning strategies, and managing interactions on social media platforms.',
    specialized: 'A category for highly domain-specific prompts that do not fit well into other categories.',
    translation:
        'Prompts focused on translating text between languages or explaining concepts across linguistic barriers.',
    writing: 'Prompts specifically for improving writing style, grammar, structure, and generating written content.',
    uncategorized: 'Prompts that have not yet been assigned a primary category.' // Added default
};
