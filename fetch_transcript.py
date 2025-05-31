import sys
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter
import json

def fetch_transcript(video_id):
    print(f"[INFO] Starting transcript fetch for video_id: {video_id}"); sys.stdout.flush()
    try:
        print("[INFO] Fetching transcript from YouTube..."); sys.stdout.flush()
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        print("[INFO] Transcript fetched successfully. Formatting..."); sys.stdout.flush()
        # Use json.dumps for output to avoid formatter errors
        formatted_transcript = json.dumps(transcript, indent=2)
        print("[INFO] Transcript formatted. Returning result."); sys.stdout.flush()
        return formatted_transcript
    except Exception as e:
        print(f"[ERROR] Exception occurred: {str(e)}"); sys.stdout.flush()
        return f'Error: {str(e)}'

if __name__ == "__main__":
    print("[INFO] Script started."); sys.stdout.flush()
    video_url = sys.argv[1]
    print(f"[INFO] Received video_url: {video_url}"); sys.stdout.flush()
    video_id = video_url.split("v=")[-1]
    print(f"[INFO] Extracted video_id: {video_id}"); sys.stdout.flush()
    result = fetch_transcript(video_id)
    print("[INFO] Script finished. Outputting result."); sys.stdout.flush()
    print(result); sys.stdout.flush()
