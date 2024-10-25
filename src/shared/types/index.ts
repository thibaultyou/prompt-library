export interface EnvVariable {
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

export interface PromptVariable {
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
    variables: PromptVariable[];
    content_hash?: string;
    fragments?: PromptFragment[];
}

export interface PromptFragment {
    name: string;
    category: string;
    variable?: string;
}
