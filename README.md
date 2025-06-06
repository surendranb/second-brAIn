# brAIn: AI-Powered Knowledge Organization for Obsidian

Transform any web content or YouTube video into organized, actionable knowledge that automatically integrates into your personal knowledge hierarchy.

## What does brAIn do?

**brAIn doesn't just summarize content — it transforms information into structured knowledge and organizes it for you.**

- 🌐 **Smart Content Processing**: Turn any web article or YouTube video into comprehensive notes
- 🧠 **AI-Powered Analysis**: Extract insights, analogies, and actionable steps using advanced AI
- 🗂️ **Automatic Organization**: Creates hierarchical knowledge maps (MOCs) that connect your learning
- 🔗 **Intelligent Linking**: Automatically connects new knowledge to your existing notes
- 📚 **Learning Enhancement**: Identifies knowledge gaps and suggests learning paths

## Why brAIn?

**Problem**: Information overload leads to shallow learning and disconnected knowledge.

**Solution**: brAIn transforms passive content consumption into active knowledge building by:
- Converting complex content into 13 structured knowledge dimensions
- Automatically organizing information into Domain → Area → Topic → Concept hierarchies  
- Creating meaningful connections between new and existing knowledge
- Preserving context and enabling easy retrieval

## Quick Start

### Prerequisites
- Obsidian (v1.0.0+)
- Node.js (v16+) 
- Python (v3.8+)
- Google Gemini API key ([Get one free](https://ai.google.dev/))

### Installation

1. **Download the plugin**:
   ```bash
   # Clone or download from GitHub
   git clone https://github.com/surendranb/second-brAIn.git
   ```

2. **Install dependencies**:
   ```bash
   cd second-brAIn
   npm install
   
   # Set up Python environment
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Install in Obsidian**:
   - Copy the entire folder to `.obsidian/plugins/` in your vault
   - Enable "Community plugins" in Obsidian settings
   - Enable "brAIn" in the plugins list

### Setup

1. **Get your Gemini API key**:
   - Go to [Google AI Studio](https://ai.google.dev/)
   - Create a new project and generate an API key

2. **Configure brAIn**:
   - Click the brAIn icon in Obsidian's ribbon
   - Enter your Gemini API key
   - Choose your preferred model (gemini-pro recommended)
   - Set your knowledge organization folder (default: "MOCs")

## How to Use

### Option 1: Create Notes from URLs
1. Click the brAIn icon in the ribbon
2. Select "Create new note from URL"
3. Paste any web URL or YouTube link
4. Click "Generate Note"
5. Watch as brAIn creates and organizes your knowledge!

### Option 2: Organize Existing Notes
1. Click the brAIn icon in the ribbon  
2. Select "Organize existing note"
3. Choose a note from the dropdown
4. Click "Organize Note"
5. Your note gets integrated into the knowledge hierarchy

## What You Get

### Comprehensive Knowledge Structure
Each processed piece of content becomes a structured note with:

- **Context & Background**: Why this information matters
- **Key Facts**: Essential information and data points
- **Multiple Perspectives**: Different viewpoints and opinions
- **Deep Insights**: Patterns, connections, and implications
- **Personal Reflection Space**: Areas for your own thoughts
- **Analogies & Examples**: Clear comparisons and real-world applications
- **Questions for Exploration**: Areas to investigate further
- **Actionable Next Steps**: Specific things you can do
- **Knowledge Connections**: Links to related concepts

### Automatic Knowledge Organization
brAIn creates a hierarchical Map of Contents (MOC) system:

```
📁 Computer Science (Domain)
  📁 Artificial Intelligence (Area)
    📁 Machine Learning (Topic)
      📄 Your Note (Concept)
      📄 Related Notes
    📁 Natural Language Processing (Topic)
  📁 Software Engineering (Area)
```

### Smart Features
- **Error Recovery**: Never loses your content, even if AI processing fails
- **Progress Tracking**: Clear status updates throughout processing
- **Customizable Prompts**: Tailor the AI analysis to your needs
- **Dual-Mode Interface**: Handle both new URLs and existing notes

## Troubleshooting

### Common Issues

**Python Script Errors**:
- Ensure Python 3.8+ is installed and in your PATH
- Activate the virtual environment: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

**Gemini API Errors**:
- Verify your API key is valid and active
- Check your API quota at [Google AI Studio](https://ai.google.dev/)
- Try switching to a different Gemini model in settings

**Plugin Not Loading**:
- Ensure the plugin folder is in `.obsidian/plugins/`
- Check that "Community plugins" is enabled in Obsidian
- Look for errors in Developer Console (Ctrl+Shift+I)

**Slow Processing**:
- Large content may take 30-60 seconds to process
- YouTube videos with long transcripts take longer
- Check your internet connection

### Getting Help
- Check the [GitHub Issues](https://github.com/surendranb/second-brAIn/issues)
- Join the discussion in [GitHub Discussions](https://github.com/surendranb/second-brAIn/discussions)

## Privacy & Security

- Your API key is stored locally in Obsidian settings
- Content is processed through Google's Gemini API (see their privacy policy)
- No personal data is stored on external servers
- All notes remain in your local Obsidian vault

## Contributing

We welcome contributions! See [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built for knowledge workers who want to learn faster and think deeper.**

Transform your information consumption into knowledge building with brAIn.
