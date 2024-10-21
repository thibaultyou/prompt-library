export function formatTitleCase(category: string): string {
    return category
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export function formatSnakeCase(variableName: string): string {
    return variableName
        .replace(/[{}]/g, '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase())
        .replace(/ /g, '_')
        .toLowerCase();
}
