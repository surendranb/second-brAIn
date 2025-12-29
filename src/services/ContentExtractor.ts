/**
 * ContentExtractor Service
 * 
 * Handles extraction of content from various sources (YouTube, web pages, etc.)
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
     */
    async extractContent(url: string): Promise<ExtractedContent> {
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

            this.validateContent(content, contentType, url);

            return {
                content,
                metadata: {
                    type: contentType,
                    url,
                    length: content.length,
                    extractedAt: new Date(),
                    platform: contentType === 'youtube' ? 'YouTube' : 'Web'
                }
            };

        } catch (error) {
            console.error('Extraction failed:', error.message);
            
            if (error instanceof ContentExtractionError) {
                throw error;
            }
            
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

    private detectContentType(url: string): 'youtube' | 'web' {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        }
        return 'web';
    }

    private validateContent(content: string, type: 'youtube' | 'web', url: string): void {
        if (!content || content.trim().length < 100) {
            throw new ContentExtractionError(
                url,
                type,
                'Content too short or empty - extraction likely failed',
                'Please try again or check if the content is available'
            );
        }

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
    }

    private async fetchYouTubeTranscript(url: string): Promise<string> {
        const path = require('path');
        // @ts-ignore
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                fullOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                const resultMarker = "[INFO] Script finished. Outputting result.";
                const markerIndex = fullOutput.lastIndexOf(resultMarker);
                let processedResult = markerIndex !== -1 
                    ? fullOutput.substring(markerIndex + resultMarker.length).trim()
                    : fullOutput.trim();

                if (processedResult.startsWith('Error: Failed to fetch transcript')) {
                    reject(new Error(`Transcript fetch failed: ${processedResult}`));
                } else if (lastErrorLine && lastErrorLine.includes('[ERROR]')) {
                    reject(new Error(`Python script error: ${lastErrorLine}`));
                } else if (fullOutput.includes('No SRT URL found')) {
                    reject(new Error('No captions available for this video'));
                } else if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}`));
                } else if (!processedResult || processedResult.trim().length < 50) {
                    reject(new Error('No meaningful transcript data was returned'));
                } else {
                    resolve(processedResult);
                }
            });

            pythonProcess.on('error', (err: Error) => {
                reject(new Error(`Failed to start transcript extraction: ${err.message}`));
            });
        });
    }

    private async fetchWebContent(url: string): Promise<string> {
        const path = require('path');
        // @ts-ignore
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_content.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                fullOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                if (lastErrorLine && lastErrorLine.includes('[ERROR]')) {
                    reject(new Error(`Python script error: ${lastErrorLine}`));
                } else if (fullOutput.includes('Failed to fetch') || fullOutput.includes('Error:')) {
                    reject(new Error('Could not fetch content from this URL'));
                } else if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}`));
                } else if (!fullOutput || fullOutput.trim().length < 50) {
                    reject(new Error('No meaningful content was returned'));
                } else {
                    resolve(fullOutput.trim());
                }
            });

            pythonProcess.on('error', (err: Error) => {
                reject(new Error(`Failed to start web content extraction: ${err.message}`));
            });
        });
    }
}