import sys
import subprocess
import json
import requests

def fetch_transcript(video_url):
    print(f"[INFO] Starting transcript fetch for video_url: {video_url}"); sys.stdout.flush()
    # Use yt-dlp to get the SRT URL
    try:
        result = subprocess.run([
            sys.executable, '-m', 'yt_dlp',
            '--write-auto-subs', '--sub-lang', 'en', '--skip-download', '-J', video_url
        ], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[ERROR] yt-dlp failed: {result.stderr}"); sys.stdout.flush()
            return None
        info = json.loads(result.stdout)
        srt_url = None
        if 'automatic_captions' in info and 'en' in info['automatic_captions']:
            for entry in info['automatic_captions']['en']:
                if entry['ext'] == 'srt':
                    srt_url = entry['url']
                    break
        if not srt_url:
            print("[ERROR] No SRT URL found for English auto-captions."); sys.stdout.flush()
            return None
        print(f"[INFO] SRT URL: {srt_url}"); sys.stdout.flush()
        response = requests.get(srt_url)
        if response.status_code != 200:
            print(f"[ERROR] Failed to download SRT: {response.status_code}"); sys.stdout.flush()
            return None
        srt_text = response.text
        print("[INFO] SRT transcript fetched successfully."); sys.stdout.flush()
        return srt_text
    except Exception as e:
        print(f"[ERROR] Exception during yt-dlp transcript fetch: {e}"); sys.stdout.flush()
        return None

def clean_srt(srt_text):
    # Remove SRT numbering and timestamps, return only the spoken text
    import re
    lines = srt_text.splitlines()
    output = []
    for line in lines:
        if re.match(r'^\d+$', line):
            continue  # skip sequence numbers
        if re.match(r'\d{2}:\d{2}:\d{2},\d{3} -->', line):
            continue  # skip timestamps
        if line.strip() == '':
            continue  # skip empty lines
        output.append(line.strip())
    return ' '.join(output)

if __name__ == "__main__":
    print("[INFO] Script started."); sys.stdout.flush()
    if len(sys.argv) > 1:
        video_url = sys.argv[1]
        print(f"[INFO] Received video_url: {video_url}"); sys.stdout.flush()
        srt_text = fetch_transcript(video_url)
        if srt_text:
            print("[INFO] Cleaning SRT transcript..."); sys.stdout.flush()
            clean_text = clean_srt(srt_text)
            print("--- Cleaned Transcript Start ---")
            print(clean_text[:2000])  # Print first 2000 chars for brevity
            print("--- Cleaned Transcript End (truncated) ---")
        else:
            print("[ERROR] Could not fetch transcript."); sys.stdout.flush()
    else:
        print("[ERROR] No video URL provided."); sys.stdout.flush()
        sys.exit(1)
