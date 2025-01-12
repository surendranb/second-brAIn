from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter
import sys

def fetch_transcript(video_id):
    try:
        # Fetch the transcript
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        # Format the transcript as JSON
        formatter = JSONFormatter()
        formatted_transcript = formatter.format_transcript(transcript)
        return formatted_transcript
    except Exception as e:
        return f'Error: {str(e)}'

if __name__ == "__main__":
    video_url = sys.argv[1]
    video_id = video_url.split("v=")[-1]  # Extract video ID from URL
    print(fetch_transcript(video_id))
