import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Platform } from 'obsidian';

export class YoutubeExtractor {
    async extract(url: string): Promise<string> {
        if (Platform.isMobile) {
            throw new Error('YouTube extraction is currently only available on Desktop (requires yt-dlp).');
        }

        const videoId = this.extractVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        // @ts-ignore
        const pluginPath = this.getPluginPath();
        const binaryPath = path.join(pluginPath, 'bin', 'yt-dlp');
        const outputPath = path.join(pluginPath, 'scratch', videoId);
        const nodePath = '/opt/homebrew/bin/node';

        return new Promise((resolve, reject) => {
            // Hardened yt-dlp arguments to bypass 429s
            const args = [
                '--skip-download',
                '--write-auto-subs',
                '--write-subs',
                '--sub-lang', 'en,en-US',
                '--sub-format', 'vtt',
                '--output', outputPath,
                // Borrow cookies from Chrome to bypass 429s (common on Mac)
                '--cookies-from-browser', 'chrome',
                // Use system node to solve signatures
                '--js-runtimes', 'node',
                // Mimic a high-fidelity browser signature
                '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                '--add-header', 'Accept-Language:en-US,en;q=0.9',
                '--add-header', 'Sec-Fetch-Mode:navigate',
                '--add-header', 'Sec-Fetch-Site:cross-site',
                '--sleep-subtitles', '1', // Add jitter to avoid detection
                url
            ];

            // Inject common Mac paths so yt-dlp can find Node to solve signatures
            const env = { 
                ...process.env, 
                PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}` 
            };

            const child = spawn(binaryPath, args, { env });

            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log('[brAIn yt-dlp]', data.toString().trim());
            });

            child.on('close', (code) => {
                if (code === 0) {
                    this.readAndCleanTranscript(outputPath)
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

    private async readAndCleanTranscript(basePath: string): Promise<string> {
        const dir = path.dirname(basePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const files = fs.readdirSync(dir);
        const transcriptFile = files.find(f => f.startsWith(path.basename(basePath)) && f.endsWith('.vtt'));

        if (!transcriptFile) {
            throw new Error('No transcript available for this video.');
        }

        const fullPath = path.join(dir, transcriptFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        const cleaned = content
            .replace(/WEBVTT[\s\S]*?\n\n/, '')
            .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g, '')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .filter(line => line.trim() && !line.includes('align:start'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        try { fs.unlinkSync(fullPath); } catch (e) {}
        return cleaned;
    }

    private getPluginPath(): string {
        // @ts-ignore
        const adapter = window.app.vault.adapter;
        // @ts-ignore
        return path.join(adapter.basePath, '.obsidian', 'plugins', 'second-brAIn');
    }

    private extractVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
}
