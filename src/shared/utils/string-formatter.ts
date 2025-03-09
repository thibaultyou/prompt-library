export function formatTitleCase(category?: string): string {
    if (!category) return 'Unknown';
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

export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) return `${diffSec} seconds ago`;

    if (diffMin < 60) return `${diffMin} minutes ago`;

    if (diffHour < 24) return `${diffHour} hours ago`;
    return `${diffDay} days ago`;
}
