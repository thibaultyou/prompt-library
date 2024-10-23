export interface EnvVar {
    id: number;
    name: string;
    value: string;
    scope: 'global' | 'prompt';
    prompt_id?: number;
}

export interface CategoryItem {
    id: string;
    title: string;
    primary_category: string;
    description: string;
    path: string;
    subcategories: string[];
}

export interface Variable {
    name: string;
    role: string;
    optional_for_user: boolean;
    value?: string;
}

export type ApiResult<T> = {
    success: boolean;
    data?: T;
    error?: string;
};

export interface PromptMetadata {
    id?: string;
    title: string;
    primary_category: string;
    subcategories: string[];
    directory: string;
    tags: string | string[];
    one_line_description: string;
    description: string;
    variables: Variable[];
    content_hash?: string;
    fragments?: Fragment[];
}

export interface Fragment {
    name: string;
    category: string;
    variable: string;
}
