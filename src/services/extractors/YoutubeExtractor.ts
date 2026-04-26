import { requestUrl } from 'obsidian';

export interface YoutubeTranscript {
    text: string;
    duration?: number;
    offset?: number;
}

export class YoutubeExtractor {
    /**
     * Extracts the transcript from a YouTube video URL.
     * Logic: 
     * 1. Fetch video page HTML
     * 2. Parse ytInitialPlayerResponse to find caption tracks
     * 3. Fetch the XML/JSON transcript from the track URL
     * 4. Clean and return text
     */
    async extract(url: string): Promise<string> {
        const videoId = this.extractVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        try {
            // 1. Fetch the video page
            const response = await requestUrl({
                url: `https://www.youtube.com/watch?v=${videoId}`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const html = response.text;

            // 2. Extract ytInitialPlayerResponse
            const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (!playerResponseMatch) {
                throw new Error('Could not find YouTube player response. The video might be private or restricted.');
            }

            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (!captionTracks || captionTracks.length === 0) {
                throw new Error('No transcript available for this video.');
            }

            // 3. Find English track (prefer non-auto-generated if available)
            const track = captionTracks.find((t: any) => t.languageCode === 'en' && !t.kind) || 
                          captionTracks.find((t: any) => t.languageCode === 'en') ||
                          captionTracks[0];

            if (!track || !track.baseUrl) {
                throw new Error('Could not find a valid English transcript track.');
            }

            // 4. Fetch the transcript data (default is XML format)
            const transcriptResponse = await requestUrl({ url: track.baseUrl });
            const transcriptXml = transcriptResponse.text;

            // 5. Parse and clean the XML
            return this.cleanTranscriptXml(transcriptXml);

        } catch (error) {
            console.error('[YoutubeExtractor] Error:', error);
            throw new Error(`YouTube Extraction Failed: ${error.message}`);
        }
    }

    private extractVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    private cleanTranscriptXml(xml: string): string {
        // Basic XML cleaning using regex to avoid heavy XML parser dependencies
        // YouTube transcripts look like: <text start="0.1" dur="2.5">Hello world</text>
        const textMatch = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
        
        if (!textMatch) return "";

        return textMatch
            .map(t => {
                return t
                    .replace(/<text[^>]*>/, '')
                    .replace(/<\/text>/, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/\n/g, ' ')
                    .trim();
            })
            .join(' ')
            .replace(/\s+/g, ' ');
    }
}
