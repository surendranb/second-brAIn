const axios = require('axios');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

// Mock YouTube Extractor Logic
async function testYoutube(url) {
    console.log(`[QA] Testing YouTube: ${url}`);
    const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)[1];
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
    const html = response.data;
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    
    if (!playerResponseMatch) throw new Error("No player response found");
    
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    console.log(`[QA] Found ${captionTracks.length} caption tracks`);
    
    const track = captionTracks.find(t => t.languageCode === 'en');
    console.log(`[QA] Using track: ${track.baseUrl}`);
    
    const transcriptRes = await axios.get(track.baseUrl);
    const xml = transcriptRes.data;
    const clean = xml.replace(/<text[^>]*>([\s\S]*?)<\/text>/g, (match, p1) => p1 + ' ')
                    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
    
    console.log(`[QA] Success! Sample: ${clean.substring(0, 100)}...`);
}

// Mock Web Extractor Logic
async function testWeb(url) {
    console.log(`[QA] Testing Web: ${url}`);
    const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const doc = new JSDOM(response.data, { url }).window.document;
    const reader = new Readability(doc);
    const article = reader.parse();
    
    const turndown = new TurndownService();
    const markdown = turndown.turndown(article.content);
    
    console.log(`[QA] Success! Title: ${article.title}`);
    console.log(`[QA] Markdown Sample: ${markdown.substring(0, 100)}...`);
}

async function runQA() {
    try {
        await testYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        console.log('---');
        await testWeb('https://en.wikipedia.org/wiki/Obsidian_(software)');
        console.log('\n✅ QA PASS: Native extraction logic is sound.');
    } catch (e) {
        console.error('\n❌ QA FAIL:', e.message);
        process.exit(1);
    }
}

runQA();
