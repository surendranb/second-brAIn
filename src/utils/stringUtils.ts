/**
 * String utility functions
 * Extracted from main.ts for better modularity
 */

/**
 * Generates a UUID v4 string
 */
export function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Extracts platform name from URL
 */
export function extractPlatformFromUrl(url: string): string {
    try {
        const domain = new URL(url).hostname.replace('www.', '');

        // Extract the main platform name from domain
        const parts = domain.split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2]; // e.g., "youtube" from "youtube.com"
        }
        return domain;
    } catch {
        return 'unknown';
    }
}

/**
 * Formats MOC context for AI consumption
 */
export function formatMOCContextForAI(existingMOCs: any[]): string {
    if (existingMOCs.length === 0) {
        return "No existing MOCs. Create first hierarchy.";
    }

    // Create compact summary by domain only
    const domains = new Set<string>();
    existingMOCs.forEach(moc => {
        if (moc.domain) domains.add(moc.domain);
    });

    return `Existing domains: ${Array.from(domains).join(', ')}`;
}