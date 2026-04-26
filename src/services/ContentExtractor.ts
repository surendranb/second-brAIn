/**
 * ContentExtractor Service (Native Version)
 * 
 * Handles extraction of content using native TypeScript implementations.
 * No external Python dependencies.
 */
import { YoutubeExtractor } from './extractors/YoutubeExtractor';
import { WebExtractor } from './extractors/WebExtractor';

export interface ExtractedContent {
    content: string;
    metadata: {
        type: 'youtube' | 'web';
        url: string;
        title?: string;
        excerpt?: string;
        byline?: string;
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
    private youtubeExtractor: YoutubeExtractor;
    private webExtractor: WebExtractor;

    constructor() {
        this.youtubeExtractor = new YoutubeExtractor();
        this.webExtractor = new WebExtractor();
    }

    /**
     * Main entry point for content extraction
     */
    async extractContent(url: string): Promise<ExtractedContent> {
        const contentType = this.detectContentType(url);
        
        try {
            if (contentType === 'youtube') {
                const transcript = await this.youtubeExtractor.extract(url);
                this.validateContent(transcript, 'youtube', url);
                
                return {
                    content: transcript,
                    metadata: {
                        type: 'youtube',
                        url,
                        length: transcript.length,
                        extractedAt: new Date(),
                        platform: 'YouTube'
                    }
                };
            } else {
                const result = await this.webExtractor.extract(url);
                this.validateContent(result.content, 'web', url);

                return {
                    content: result.content,
                    metadata: {
                        type: 'web',
                        url,
                        title: result.title,
                        excerpt: result.excerpt,
                        byline: result.byline,
                        length: result.content.length,
                        extractedAt: new Date(),
                        platform: 'Web'
                    }
                };
            }

        } catch (error) {
            console.error('[ContentExtractor] Extraction failed:', error.message);
            
            if (error instanceof ContentExtractionError) {
                throw error;
            }
            
            const suggestion = contentType === 'youtube' 
                ? 'Please ensure the video has English captions available.'
                : 'Please check if the URL is publicly accessible.';
                
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
        if (!content || content.trim().length < 50) {
            throw new ContentExtractionError(
                url,
                type,
                'Content too short or empty - extraction likely failed',
                'Please try again or check if the content is available'
            );
        }
    }
}