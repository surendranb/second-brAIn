# brAIn: Your AI-Powered Knowledge Archive in Obsidian

![brAIn Logo or Banner](https://placehold.co/800x200/3498db/ffffff?text=brAIn+AI+Summarizer)

**brAIn** is an Obsidian plugin designed to help you build a powerful second brain by effortlessly capturing and summarizing knowledge from the web and YouTube. Currently it leverages the Gemini API and allows you to quickly transform content into actionable notes, fostering a dynamic and interconnected knowledge archive within Obsidian.

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
*   **Knowledge Graph Integration:** Automatically creates internal links for speakers, topics, and related concepts, building a rich knowledge graph.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [Python](https://www.python.org/) (v3.8 or higher)
*   [Obsidian](https://obsidian.md/) (v1.0.0 or higher)
*   A [Gemini API key](https://ai.google.dev/) from Google Cloud

## Installation

### For Users

1.  Download the latest release from the [GitHub releases page](https://github.com/surendranb/second-brAIn/releases).
2.  Extract the downloaded ZIP file into your Obsidian vault's plugins folder (usually `.obsidian/plugins`).
3.  Enable the plugin in Obsidian's settings under "Community plugins".

### For Developers

1. Clone the repository:
   ```bash
   git clone https://github.com/surendranb/second-brAIn.git
   cd second-brAIn
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Set up Python virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Build the plugin:
   ```bash
   npm run build
   ```

5. Enable developer mode in Obsidian:
   - Open Obsidian Settings
   - Go to "Community plugins"
   - Turn on "Developer mode"
   - Click "Open plugins folder"
   - Copy the entire `second-brAIn` folder to the plugins directory

## Setup

1.  **Obtain a Gemini API Key:**
    - Go to [Google AI Studio](https://ai.google.dev/)
    - Create a new project or select an existing one
    - Enable the Gemini API
    - Create an API key

2.  **Configure Plugin Settings:**
    *   Open the "AI Summarizer" view from the ribbon icon
    *   Enter your Gemini API key in the settings
    *   Choose your preferred Gemini model
    *   Customize the default summarization prompt (optional)
    *   Specify the folder where new notes will be saved

## Usage

1.  Open the "AI Summarizer" view from the ribbon icon
2.  Enter the URL of the web page or YouTube video you want to summarize
3.  Enter your desired prompt (or use the default prompt)
4.  Click the "Summarize" button
5.  Review the generated summary
6.  Click the "Create Note" button to save the summary as a new note in Obsidian

The generated note will include:
- YAML frontmatter with metadata
- Structured summary with Obsidian callouts
- Internal links for speakers, topics, and related concepts
- Tags for easy categorization
- Source information and links

## Development

### Project Structure
- `main.ts`: Main plugin code
- `settings.ts`: Plugin settings and configuration
- `fetch_content.py`: Python script for web content extraction
- `fetch_transcript.py`: Python script for YouTube transcript fetching
- `styles.css`: Plugin styling

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

## Troubleshooting

*   **Python Script Errors:**
    - Ensure Python 3.8+ is installed
    - Verify the virtual environment is activated
    - Check that all Python dependencies are installed
    - Ensure the scripts have execute permissions

*   **Gemini API Errors:**
    - Verify your API key is valid
    - Check your API quota and limits
    - Ensure you've selected a valid model

*   **Plugin Not Loading:**
    - Verify the plugin is in the correct directory
    - Check that developer mode is enabled
    - Look for errors in the developer console (Ctrl+Shift+I)

## Reporting Issues

If you encounter any bugs or have feature requests, please submit an issue on the [GitHub issues page](https://github.com/surendranb/second-brAIn/issues).

## Contributing

Contributions are welcome! Please submit a pull request with your changes.

## License

This project is licensed under the MIT License.
