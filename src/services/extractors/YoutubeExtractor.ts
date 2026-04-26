import { spawn } from 'child_process';
import { Platform, normalizePath, App } from 'obsidian';

export class YoutubeExtractor {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async extract(url: string): Promise<string> {
        if (Platform.isMobile) {
            throw new Error('YouTube extraction is currently only available on Desktop (requires yt-dlp).');
        }

        const videoId = this.extractVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        const adapter = this.app.vault.adapter as any;
        if (!adapter.basePath) throw new Error('Cannot determine vault base path');

        const pluginDir = normalizePath('.obsidian/plugins/axiom');
        const binaryPath = (adapter.getFullPath ? adapter.getFullPath(normalizePath(`${pluginDir}/bin/yt-dlp`)) : `${adapter.basePath}/${pluginDir}/bin/yt-dlp`);
        const scratchDir = normalizePath(`${pluginDir}/scratch`);
        const outputPath = (adapter.getFullPath ? adapter.getFullPath(normalizePath(`${scratchDir}/${videoId}`)) : `${adapter.basePath}/${scratchDir}/${videoId}`);

        // Ensure scratch dir exists
        if (!(await this.app.vault.adapter.exists(scratchDir))) {
            await this.app.vault.adapter.mkdir(scratchDir);
        }

        return new Promise((resolve, reject) => {
            const args = [
                '--skip-download',
                '--write-auto-subs',
                '--write-subs',
                '--sub-lang', 'en,en-US',
                '--sub-format', 'vtt',
                '--output', outputPath,
                '--cookies-from-browser', 'chrome',
                '--js-runtimes', 'node',
                '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                '--add-header', 'Accept-Language:en-US,en;q=0.9',
                '--add-header', 'Sec-Fetch-Mode:navigate',
                '--add-header', 'Sec-Fetch-Site:cross-site',
                '--sleep-subtitles', '1',
                url
            ];

            const env = { 
                ...process.env, 
                PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}` 
            };

            const child = spawn(binaryPath, args, { env });

            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    this.readAndCleanTranscript(scratchDir, videoId)
                        .then(resolve)
                        .catch(reject);
                } else {
                    const errorMsg = stderr.split('\n').filter(l => l.includes('ERROR')).pop() || 'Extraction failed.';
                    reject(new Error(`yt-dlp: ${errorMsg}`));
                }
            });

            setTimeout(() => { child.kill(); reject(new Error('yt-dlp timed out.')); }, 60000);
        });
    }

    private async readAndCleanTranscript(scratchDir: string, videoId: string): Promise<string> {
        const files = await this.app.vault.adapter.list(scratchDir);
        const transcriptFile = files.files.find(f => f.includes(videoId) && f.endsWith('.vtt'));

        if (!transcriptFile) {
            throw new Error('No transcript available for this video.');
        }

        const content = await this.app.vault.adapter.read(transcriptFile);
        
        const cleaned = content
            .replace(/WEBVTT[\s\S]*?\n\n/, '')
            .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g, '')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .filter(line => line.trim() && !line.includes('align:start'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        try { await this.app.vault.adapter.remove(transcriptFile); } catch (e) {}
        return cleaned;
    }

    private extractVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
}
