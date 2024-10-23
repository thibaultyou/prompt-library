export function formatTitleCase(category: string): string {
    return category
        .split(/[_-]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export function formatSnakeCase(variableName: string): string {
    return variableName
        .replace(/[{}]/g, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[-\s_]+/g, '_')
        .replace(/^_/, '')
        .replace(/_$/g, '');
}
