import sys
import requests
from bs4 import BeautifulSoup

def fetch_content(url):
    print(f"[INFO] Starting content fetch for URL: {url}"); sys.stdout.flush()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    }
    
    try:
        print("[INFO] Sending HTTP GET request..."); sys.stdout.flush()
        # Fetch the content from the URL with headers
        response = requests.get(url, headers=headers)
        print(f"[INFO] HTTP GET completed with status code: {response.status_code}"); sys.stdout.flush()
        response.raise_for_status()  # Raise an error for bad status codes
        print("[INFO] Parsing content with BeautifulSoup..."); sys.stdout.flush()
        # Parse the content using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        content = soup.get_text()
        print("[INFO] Content parsed and extracted."); sys.stdout.flush()
        return content.strip()

    except requests.RequestException as e:
        print(f"[ERROR] Exception occurred: {e}"); sys.stdout.flush()
        return ""

if __name__ == "__main__":
    print("[INFO] Script started."); sys.stdout.flush()
    url = sys.argv[1]  # Get the URL from command-line arguments
    print(f"[INFO] Received URL: {url}"); sys.stdout.flush()
    result = fetch_content(url)
    print("[INFO] Script finished. Outputting result."); sys.stdout.flush()
    print(result); sys.stdout.flush()
