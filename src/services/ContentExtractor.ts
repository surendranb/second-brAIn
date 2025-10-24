/**
 * ContentExtractor Service
 * 
 * Handles extraction of content from various sources (YouTube, web pages, etc.)
 * Provides a clean interface for content extraction with proper error handling
 * and validation to ensure the process stops when content cannot be extracted.
 */

export interface ExtractedContent {
    content: string;
    metadata: {
        type: 'youtube' | 'web';
        url: string;
        title?: string;
        length: number;
        extractedAt: Date;
        platform?: string;
    };
}

export class ContentExtractionError extends Error {
    constructor(
        public url: string,
        public extractorType: 'youtube' | 'web',
        public reason: string,
        public suggestion: string
    ) {
        super(`Failed to extract content from ${extractorType}: ${reason}. ${suggestion}`);
        this.name = 'ContentExtractionError';
    }
}

export class ContentExtractor {
    private plugin: any;

    constructor(plugin: any) {
        this.plugin = plugin;
    }

    /**
     * Main entry point for content extraction
     * Determines the content type and delegates to appropriate extractor
     */
    async extractContent(url: string): Promise<ExtractedContent> {
        console.log('[ContentExtractor] Starting extraction for:', url);
        
        const contentType = this.detectContentType(url);
        let content: string;
        
        try {
            switch (contentType) {
                case 'youtube':
                    content = await this.fetchYouTubeTranscript(url);
                    break;
                case 'web':
                    content = await this.fetchWebContent(url);
                    break;
                default:
                    throw new ContentExtractionError(
                        url,
                        'web',
                        'Unsupported URL type',
                        'Please provide a valid YouTube or web URL'
                    );
            }

            // Validate extracted content
            this.validateContent(content, contentType, url);

            const extractedContent: ExtractedContent = {
                content,
                metadata: {
                    type: contentType,
                    url,
                    length: content.length,
                    extractedAt: new Date(),
                    platform: contentType === 'youtube' ? 'YouTube' : 'Web'
                }
            };

            console.log(`[ContentExtractor] ✅ Successfully extracted ${contentType} content:`, {
                url,
                length: content.length,
                type: contentType
            });

            return extractedContent;

        } catch (error) {
            console.error('[ContentExtractor] ❌ Extraction failed:', error.message);
            
            // If it's already a ContentExtractionError, re-throw it
            if (error instanceof ContentExtractionError) {
                throw error;
            }
            
            // Convert other errors to ContentExtractionError
            const suggestion = contentType === 'youtube' 
                ? 'Please ensure the video has captions available and try again'
                : 'Please check if the URL is accessible and not behind authentication';
                
            throw new ContentExtractionError(
                url,
                contentType,
                error.message,
                suggestion
            );
        }
    }

    /**
     * Detect content type based on URL
     */
    private detectContentType(url: string): 'youtube' | 'web' {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        }
        return 'web';
    }

    /**
     * Validate extracted content to ensure it's meaningful
     * Throws ContentExtractionError if validation fails
     */
    private validateContent(content: string, type: 'youtube' | 'web', url: string): void {
        // Check if content exists and has minimum length
        if (!content || content.trim().length < 100) {
            throw new ContentExtractionError(
                url,
                type,
                'Content too short or empty - extraction likely failed',
                'Please try again or check if the content is available'
            );
        }

        // Check for error indicators in the content
        const errorIndicators = [
            '[ERROR]',
            'Could not fetch',
            'No SRT URL found',
            'Failed to fetch',
            'Error:',
            'Exception:'
        ];

        for (const indicator of errorIndicators) {
            if (content.includes(indicator)) {
                throw new ContentExtractionError(
                    url,
                    type,
                    `Content contains error indicator: ${indicator}`,
                    'The extraction process encountered an error - please try again'
                );
            }
        }

        console.log(`[ContentExtractor] ✅ Content validation passed for ${type}:`, {
            length: content.length,
            hasContent: content.trim().length > 0
        });
    }

    /**
     * Extract transcript from YouTube video using Python script
     */
    private async fetchYouTubeTranscript(url: string): Promise<string> {
        console.log('[ContentExtractor] Extracting YouTube transcript for:', url);
        
        const path = require('path');
        
        // Get vault path for script location
        // @ts-ignore - Access vault adapter path
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        console.log('[ContentExtractor] Running Python script:', { venvPython, scriptPath, url });

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[ContentExtractor] Python STDOUT:', output);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                console.error('[ContentExtractor] Python STDERR:', errorOutput);
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[ContentExtractor] Python process exited with code ${code}`);

                // Extract the actual result from the output
                const resultMarker = "[INFO] Script finished. Outputting result.";
                const markerIndex = fullOutput.lastIndexOf(resultMarker);
                let processedResult = "";

                if (markerIndex !== -1) {
                    processedResult = fullOutput.substring(markerIndex + resultMarker.length).trim();
                } else {
                    processedResult = fullOutput.trim();
                }

                // Comprehensive error checking
                if (processedResult.startsWith('Error: Failed to fetch transcript after')) {
                    reject(new Error(`Transcript fetch failed: ${processedResult}`));
                } else if (lastErrorLine && lastErrorLine.includes('[ERROR]')) {
                    reject(new Error(`Python script error: ${lastErrorLine}`));
                } else if (fullOutput.includes('No SRT URL found')) {
                    reject(new Error('No captions available for this video'));
                } else if (fullOutput.includes('Could not fetch transcript')) {
                    reject(new Error('Could not fetch transcript from this video'));
                } else if (code !== 0) {
                    const errorMsg = `Python script exited with code ${code}. Output: ${processedResult || 'No output'}`;
                    reject(new Error(errorMsg));
                } else if (!processedResult || processedResult.trim().length < 50) {
                    reject(new Error('No meaningful transcript data was returned'));
                } else {
                    console.log('[ContentExtractor] ✅ YouTube transcript extracted successfully');
                    resolve(processedResult);
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[ContentExtractor] Failed to start Python process:', err);
                reject(new Error(`Failed to start transcript extraction process: ${err.message}`));
            });
        });
    }

    /**
     * Extract content from web page using Python script
     */
    private async fetchWebContent(url: string): Promise<string> {
        console.log('[ContentExtractor] Extracting web content for:', url);
        
        const path = require('path');
        
        // Get vault path for script location
        // @ts-ignore - Access vault adapter path
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_content.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        console.log('[ContentExtractor] Running Python script:', { venvPython, scriptPath, url });

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[ContentExtractor] Python STDOUT:', output);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                console.error('[ContentExtractor] Python STDERR:', errorOutput);
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[ContentExtractor] Python process exited with code ${code}`);
                
                // Comprehensive error checking for web content
                if (lastErrorLine && lastErrorLine.includes('[ERROR]')) {
                    reject(new Error(`Python script error: ${lastErrorLine}`));
                } else if (fullOutput.includes('Failed to fetch') || fullOutput.includes('Error:')) {
                    reject(new Error('Could not fetch content from this URL'));
                } else if (code !== 0) {
                    const errorMsg = lastErrorLine || `Python script exited with code ${code}. Output: ${fullOutput}`;
                    reject(new Error(errorMsg));
                } else if (!fullOutput || fullOutput.trim().length < 50) {
                    reject(new Error('No meaningful content was returned'));
                } else {
                    console.log('[ContentExtractor] ✅ Web content extracted successfully');
                    resolve(fullOutput.trim());
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[ContentExtractor] Failed to start Python process:', err);
                reject(new Error(`Failed to start web content extraction process: ${err.message}`));
            });
        });
    }
}