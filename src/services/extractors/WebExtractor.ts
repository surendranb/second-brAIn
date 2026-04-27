import { requestUrl } from 'obsidian';
import { Readability } from '@mozilla/readability';
import * as TurndownService from 'turndown';

export class WebExtractor {
    private turndownService: unknown;

    constructor() {
        // @ts-ignore - Turndown constructor sometimes has issues with ES modules in Obsidian environment
        this.turndownService = new (TurndownService.default || TurndownService)({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced'
        });
    }

    /**
     * Extracts the core content of a web page.
     * Logic:
     * 1. Fetch HTML via requestUrl
     * 2. Parse into DOM (using built-in DOMParser)
     * 3. Run Readability to identify main content
     * 4. Convert to clean Markdown via Turndown
     */
    async extract(url: string): Promise<{ title: string; content: string; excerpt: string; byline: string }> {
        try {
            const response = await requestUrl({
                url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const html = response.text;
            
            // Obsidian environment has DOMParser available
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Fix relative links before parsing
            this.fixRelativeLinks(doc, url);

            // Readability needs a copy because it modifies the DOM
            const article = new Readability(doc).parse();

            if (!article) {
                throw new Error('Readability failed to extract content from this page.');
            }

            // Convert HTML content to Markdown
            const markdownContent = this.turndownService.turndown(article.content);

            return {
                title: article.title || 'Untitled',
                content: markdownContent || '',
                excerpt: article.excerpt || '',
                byline: article.byline || ''
            };

        } catch (error) {
            console.error('[WebExtractor] Error:', error);
            throw new Error(`Web Extraction Failed: ${error.message}`);
        }
    }

    private fixRelativeLinks(doc: Document, baseUrl: string) {
        const base = new URL(baseUrl);
        
        doc.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                try {
                    a.setAttribute('href', new URL(href, base).href);
                } catch (e) {
                    /* ignore invalid URLs during link fixing */
                }
            }
        });

        doc.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http')) {
                try {
                    img.setAttribute('src', new URL(src, base).href);
                } catch (e) {
                    /* ignore invalid URLs during link fixing */
                }
            }
        });
    }
}
