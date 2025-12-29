/**
 * File utility functions
 * Extracted from main.ts for better modularity
 */

import { App } from 'obsidian';

/**
 * Sanitizes a filename by replacing invalid characters with underscores
 */
export function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * Finds a unique filename by adding numbers if conflicts exist
 */
export async function findUniqueFileName(app: App, folderPath: string, fileName: string): Promise<string> {
    // Check if the original filename is available
    const originalPath = `${folderPath}/${fileName}`;
    const existingFile = app.vault.getAbstractFileByPath(originalPath);

    if (!existingFile) {
        return fileName; // Original name is available
    }

    // Extract name and extension
    const nameParts = fileName.split('.');
    const extension = nameParts.pop() || '';
    const baseName = nameParts.join('.');

    // Try numbered variants
    let counter = 1;
    while (counter <= 999) { // Prevent infinite loops
        const numberedName = `${baseName} (${counter}).${extension}`;
        const numberedPath = `${folderPath}/${numberedName}`;
        const conflictFile = app.vault.getAbstractFileByPath(numberedPath);

        if (!conflictFile) {
            return numberedName;
        }

        counter++;
    }

    // If we get here, fall back to timestamp-based naming
    const timestamp = new Date().getTime();
    const timestampName = `${baseName}_${timestamp}.${extension}`;
    return timestampName;
}