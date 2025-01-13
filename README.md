# brAIn: Your AI-Powered Knowledge Archive in Obsidian

![brAIn Logo or Banner](https://placehold.co/800x200/3498db/ffffff?text=brAIn+AI+Summarizer)

**brAIn** is an Obsidian plugin designed to help you build a powerful second brain by effortlessly capturing and summarizing knowledge from the web and YouTube. Currently it leverages the Gemini API and  allows you to quickly transform content into actionable notes, fostering a dynamic and interconnected knowledge archive within Obsidian.

## Why brAIn?

In today's information-rich world, it's easy to get overwhelmed. brAIn helps you cut through the noise and focus on what truly matters by:

*   **Effortless Knowledge Capture:** Quickly summarize articles, blog posts, and YouTube videos without tedious manual note-taking.
*   **Enhanced Comprehension:** Condense complex information into concise summaries, improving your understanding and retention.
*   **Seamless Integration:** Create new notes directly within Obsidian, seamlessly integrating your summarized knowledge into your existing workflow.
*   **Dynamic Knowledge Base:** Build a dynamic and interconnected knowledge archive that grows with your learning.
*   **AI-Powered Insights:** Leverage the power of the Gemini API to extract key insights and generate meaningful summaries.

## Key Features

*   **Web Page Summarization:** Summarize content from any web page, including blogs, articles, and online documentation.
*   **YouTube Transcript Summarization:** Extract and summarize transcripts from YouTube videos, capturing valuable insights from video content.
*   **Customizable Prompts:** Tailor the summarization process with custom prompts to focus on specific aspects of the content.
*   **Flexible Note Creation:** Create new notes directly within Obsidian, with the summary and source URL included.
*   **Configurable Settings:** Easily configure your Gemini API key, model, default prompt, and notes folder.

## How it Works

brAIn uses Python scripts to fetch content from web pages and YouTube videos. It then leverages the Gemini API to generate concise and informative summaries. These summaries are then used to create new notes within your Obsidian vault, allowing you to build a dynamic and interconnected knowledge base.

## Installation

1.  Download the latest release from the [GitHub releases page](https://github.com/surendranb/second-brAIn/releases).
2.  Extract the downloaded ZIP file into your Obsidian vault's plugins folder (usually `.obsidian/plugins`).
3.  Enable the plugin in Obsidian's settings under "Community plugins".

## Setup

1.  **Obtain a Gemini API Key:** You'll need a Gemini API key from Google Cloud.
2.  **Install Python Dependencies:** This plugin uses Python scripts for web scraping and YouTube transcript fetching. To run these scripts, you need to install the following Python libraries:

    ```bash
    pip install -r requirements.txt
    ```

    Make sure you have Python 3 installed on your system.
3.  **Configure Plugin Settings:**
    *   Open the "AI Summarizer" view from the ribbon icon.
    *   Enter your Gemini API key in the settings.
    *   Choose your preferred Gemini model.
    *   Customize the default summarization prompt (optional).
    *   Specify the folder where new notes will be saved.

## Usage

1.  Open the "AI Summarizer" view from the ribbon icon.
2.  Enter the URL of the web page or YouTube video you want to summarize.
3.  Enter your desired prompt (or use the default prompt).
4.  Click the "Summarize" button.
5.  Review the generated summary.
6.  Click the "Create Note" button to save the summary as a new note in Obsidian.

## Screenshots

[Optional: Add screenshots or a GIF demonstrating the plugin's usage]

## Troubleshooting

*   **Python Script Errors:** Ensure that you have Python 3 installed and that the `fetch_content.py` and `fetch_transcript.py` scripts are in the correct location.
*   **Gemini API Errors:** Ensure that your Gemini API key is valid and that you have selected a valid model.
*   **Plugin Not Loading:** If the plugin is not loading, ensure that you have followed the installation instructions correctly and that the plugin is enabled in Obsidian's settings.

## Reporting Issues

If you encounter any bugs or have feature requests, please submit an issue on the [GitHub issues page](https://github.com/surendranb/second-brAIn/issues).

## Contributing

Contributions are welcome! Please submit a pull request with your changes.

## License

This project is licensed under the MIT License.
