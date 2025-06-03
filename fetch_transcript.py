import sys
import time # Added for sleep
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter
import json

def fetch_transcript(video_id):
    print(f"[INFO] Starting transcript fetch for video_id: {video_id}"); sys.stdout.flush()
    retries = 3
    delay = 5  # seconds
    for attempt in range(retries):
        try:
            print(f"[INFO] Attempt {attempt + 1}/{retries}: Fetching transcript from YouTube..."); sys.stdout.flush()
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Try to find English transcript, otherwise try to translate
            transcript = None
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
                print("[INFO] Found generated English transcript."); sys.stdout.flush()
            except Exception as e_gen:
                print(f"[WARN] No generated English transcript found: {e_gen}. Trying manually created English transcript..."); sys.stdout.flush()
                try:
                    transcript = transcript_list.find_manually_created_transcript(['en'])
                    print("[INFO] Found manually created English transcript."); sys.stdout.flush()
                except Exception as e_manual:
                    print(f"[WARN] No manually created English transcript found: {e_manual}. Attempting to find translatable transcript..."); sys.stdout.flush()
                    # Iterate through available transcripts and try to translate if 'en' is not available
                    available_langs = [t.language for t in transcript_list]
                    print(f"[INFO] Available languages for translation: {available_langs}"); sys.stdout.flush()
                    translatable_transcript = None
                    for lang_code in available_langs:
                        try:
                            temp_transcript = transcript_list.find_generated_transcript([lang_code])
                            if temp_transcript.is_translatable:
                                translatable_transcript = temp_transcript
                                print(f"[INFO] Found translatable transcript in '{lang_code}'. Translating to English..."); sys.stdout.flush()
                                transcript = translatable_transcript.translate('en')
                                break
                        except Exception as e_translate_find:
                            print(f"[WARN] Could not find or translate transcript for lang '{lang_code}': {e_translate_find}"); sys.stdout.flush()
                            continue # try next language
                    if not transcript:
                         print(f"[ERROR] No suitable transcript found for translation after checking all available languages."); sys.stdout.flush()
                         raise Exception("No suitable transcript found (generated, manual, or translatable).")


            fetched_transcript_data = transcript.fetch()
            print("[INFO] Transcript fetched successfully. Formatting..."); sys.stdout.flush()

            formatter = JSONFormatter()
            formatted_transcript = formatter.format_transcript(fetched_transcript_data) # Use fetched_transcript_data

            print("[INFO] Transcript formatted. Returning result."); sys.stdout.flush()
            return formatted_transcript
        except Exception as e:
            print(f"[ERROR] Attempt {attempt + 1}/{retries} failed: {str(e)}"); sys.stdout.flush()
            if attempt < retries - 1:
                print(f"[INFO] Retrying in {delay} seconds..."); sys.stdout.flush()
                time.sleep(delay)
            else:
                print(f"[ERROR] All {retries} retries failed."); sys.stdout.flush()
                return f'Error: Failed to fetch transcript after {retries} attempts. Last error: {str(e)}'

if __name__ == "__main__":
    print("[INFO] Script started."); sys.stdout.flush()
    if len(sys.argv) > 1:
        video_url = sys.argv[1]
        print(f"[INFO] Received video_url: {video_url}"); sys.stdout.flush()
        # Basic video ID extraction, handles standard YouTube URLs
        if "v=" in video_url:
            video_id = video_url.split("v=")[-1].split("&")[0]
        elif "youtu.be/" in video_url:
            video_id = video_url.split("youtu.be/")[-1].split("?")[0]
        else:
            print(f"[ERROR] Invalid YouTube URL format: {video_url}"); sys.stdout.flush()
            sys.exit(1)

        print(f"[INFO] Extracted video_id: {video_id}"); sys.stdout.flush()
        result = fetch_transcript(video_id)
        print("[INFO] Script finished. Outputting result."); sys.stdout.flush()
        print(result); sys.stdout.flush()
    else:
        print("[ERROR] No video URL provided."); sys.stdout.flush()
        sys.exit(1)
