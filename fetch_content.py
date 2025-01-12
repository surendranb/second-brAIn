import sys
import requests
from bs4 import BeautifulSoup

def fetch_content(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    }
    
    try:
        # Fetch the content from the URL with headers
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an error for bad status codes

        # Parse the content using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract text from the main content areas (this might need customization)
        content = soup.get_text()

        return content.strip()

    except requests.RequestException as e:
        print(f"Error fetching content: {e}")
        return ""

if __name__ == "__main__":
    url = sys.argv[1]  # Get the URL from command-line arguments
    content = fetch_content(url)
    print(content)
