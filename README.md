# brAIn - AI Summarizer for Obsidian

A powerful Obsidian plugin that uses the Gemini API to summarize content from web pages and YouTube videos, allowing you to quickly create notes and build your knowledge base.

## Features

*   Summarize content from web pages (blogs, articles, etc.).
*   Summarize YouTube video transcripts.
*   Create new notes in Obsidian with the generated summaries.
*   Configure the Gemini API key and model.
*   Customize the default summarization prompt.
*   Specify the folder where notes will be saved.

## Installation

1.  Download the latest release from the [GitHub releases page](https://github.com/your-username/your-repo/releases).
2.  Extract the downloaded ZIP file into your Obsidian vault's plugins folder (usually `.obsidian/plugins`).
3.  Enable the plugin in Obsidian's settings under "Community plugins".

## Usage

1.  Open the "AI Summarizer" view from the ribbon icon.
2.  Enter the URL of the web page or YouTube video you want to summarize.
3.  Enter your desired prompt (or use the default prompt).
4.  Click the "Summarize" button.
5.  Review the generated summary.
6.  Click the "Create Note" button to save the summary as a new note in Obsidian.

## Settings

*   **Gemini API Key:** Your Gemini API key.
*   **Gemini Model:** The Gemini model to use for summarization.
*   **Prompt:** The default prompt used for summarization.
*   **Notes Folder:** The folder where new notes will be saved.

## Python Dependencies

This plugin uses Python scripts for web scraping and YouTube transcript fetching. To run these scripts, you need to install the following Python libraries:

```bash
pip install -r requirements.txt
```

Make sure you have Python 3 installed on your system.

## Troubleshooting

* Python Script Errors: Ensure that you have Python 3 installed and that the fetch_content.py and fetch_transcript.py scripts are in the correct location.

* Gemini API Errors: Ensure that your Gemini API key is valid and that you have selected a valid model.

## Contributing
Contributions are welcome! Please submit a pull request with your changes.

## License
This project is licensed under the MIT License.