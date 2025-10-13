# brAIn: AI-Powered Knowledge Organization for Obsidian

Transform web content and YouTube videos into structured, organized knowledge using AI analysis and hierarchical organization.

## What brAIn Does

**brAIn transforms information into structured knowledge and intelligently organizes it within your personal knowledge hierarchy.**

### Core Features
- 🌐 **Content Processing**: Web articles, blog posts, and YouTube videos
- 🧠 **5-Pass AI Analysis**: Comprehensive analysis across multiple dimensions
- 🗂️ **Hierarchical MOCs**: Automatic organization into Domain → Area → Topic → Concept structure
- 🔗 **Context-Aware Placement**: AI understands existing knowledge structure to avoid duplicates
- 📚 **Cross-Domain Detection**: Identifies content spanning multiple knowledge areas
- 🔧 **Robust Error Handling**: Advanced fallback mechanisms ensure reliable processing

### 5-Pass Analysis System
1. **Structure & Metadata**: Title optimization, hierarchy placement, learning context
2. **Content Analysis**: Key facts, insights, core concepts, detailed summaries
3. **Perspectives & Examples**: Multiple viewpoints, analogies, real-world applications
4. **Connections & Applications**: Cross-domain links, practical applications, implications
5. **Learning & Next Steps**: Knowledge gaps, learning pathways, actionable steps

## ✨ Recent Major Improvements

### 🎯 Context-Aware AI Intelligence
- **Hierarchy Context Integration**: AI now analyzes your complete existing knowledge structure before making placement decisions
- **Smart Conflict Detection**: Prevents creation of parallel hierarchies for related concepts
- **Intelligent Nesting**: Automatically places new content under existing relevant hierarchies

### 🔧 Enhanced Reliability
- **Robust MOC Creation**: Advanced error handling with detailed debugging for folder and file creation
- **Improved JSON Parsing**: Strengthened AI response processing with better validation
- **Comprehensive Error Recovery**: Clear, actionable error messages with diagnostic information

### 🗂️ Centralized Knowledge Management
- **Single Source of Truth**: Centralized hierarchy.json file maintains complete knowledge structure
- **Faster Hierarchy Lookups**: Optimized performance through unified hierarchy management
- **Intelligent Conflict Resolution**: Automated detection and resolution of hierarchy placement conflicts

## Quick Start

### Prerequisites
- Obsidian (v1.0.0+)
- Node.js (v16+) 
- Python (v3.8+)
- Google Gemini API key ([Get one free](https://ai.google.dev/)) or OpenRouter API access

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
   
   # Set up Python environment for YouTube transcript processing
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

1. **Choose your AI provider**:
   - **Gemini** (Recommended): Go to [Google AI Studio](https://ai.google.dev/) for a free API key
   - **OpenRouter**: Visit [OpenRouter](https://openrouter.ai/) for access to multiple AI models

2. **Configure brAIn**:
   - Click the brAIn icon in Obsidian's ribbon
   - Select your preferred AI provider (Gemini/OpenRouter)
   - Enter your API key
   - Choose your preferred model (gemini-2.0-flash recommended)
   - Set your knowledge organization folder (default: "MOCs")

## How to Use

### Option 1: Create Notes from URLs
1. Click the brAIn icon in the ribbon
2. Select "Create new note from URL"
3. Paste any web URL or YouTube link
4. Click "Generate Note"
5. Watch as brAIn intelligently analyzes, creates, and organizes your knowledge!

### Option 2: Organize Existing Notes  
1. Click the brAIn icon in the ribbon  
2. Select "Organize existing note"
3. Choose a note from the dropdown
4. Click "Organize Note"
5. Your note gets intelligently integrated into the optimal knowledge hierarchy

## What You Get

### Comprehensive Knowledge Structure
Each processed piece of content becomes a structured note with:

- **Context & Background**: Why this information matters and its broader significance
- **Key Facts**: Essential information and data points with source verification
- **Multiple Perspectives**: Different viewpoints, opinions, and stakeholder insights
- **Deep Insights**: Patterns, connections, implications, and meta-analysis
- **Personal Reflection Space**: Dedicated areas for your own thoughts and connections
- **Analogies & Examples**: Clear comparisons and real-world applications
- **Questions for Exploration**: Curated areas to investigate further
- **Actionable Next Steps**: Specific, prioritized things you can do
- **Knowledge Connections**: Intelligent links to related concepts and prerequisites
- **Learning Context**: Prerequisites, complexity level, estimated reading time

### Intelligent Knowledge Organization
brAIn creates and maintains a context-aware hierarchical Map of Contents (MOC) system:

```
📁 Technology (Domain)
  📁 Artificial Intelligence (Area)
    📁 Computer Vision (Topic)
      📁 World Models (Concept)
        📄 Your New Video Note (intelligently placed here)
        📄 Related Existing Notes
    📁 Natural Language Processing (Topic)
  📁 Software Engineering (Area)
```

### Smart Features
- **🎯 Context-Aware Placement**: AI understands your existing knowledge structure
- **🔧 Advanced Error Recovery**: Comprehensive debugging and failure recovery
- **📊 Progress Tracking**: Detailed status updates throughout processing
- **🎨 Customizable Prompts**: Tailor the AI analysis to your specific needs
- **🔄 Dual-Mode Interface**: Seamlessly handle both new URLs and existing notes
- **⚡ Optimized Performance**: Fast hierarchy lookups and intelligent caching
- **🛡️ Robust JSON Processing**: Native JSON mode support with fallback parsing

## Advanced Features

### Hierarchy Management
- **Centralized Knowledge Map**: Single hierarchy.json file tracks your complete knowledge structure
- **Conflict Detection**: Automatically identifies and resolves hierarchy placement conflicts
- **Smart Normalization**: Handles plurals, similar concepts, and naming variations
- **Learning Paths**: AI suggests optimal learning progressions through your knowledge

### Developer Features
- **Comprehensive Logging**: Detailed debugging information for troubleshooting
- **Modular Architecture**: Clean separation of concerns with specialized managers
- **Extensible Prompts**: External prompt files for easy customization
- **TypeScript Support**: Full type safety and modern development practices

## Troubleshooting

### Common Issues

**🐍 Python Script Errors**:
- Ensure Python 3.8+ is installed and accessible
- Activate the virtual environment: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`
- Check YouTube transcript extraction permissions

**🤖 AI API Errors**:
- **Gemini**: Verify your API key at [Google AI Studio](https://ai.google.dev/)
- **OpenRouter**: Check your credits and model access at [OpenRouter](https://openrouter.ai/)
- Try switching to a different AI model in settings
- Check API quotas and rate limits

**🔧 MOC Creation Issues**:
- Check the browser console for detailed MOC creation logs
- Verify folder permissions in your vault
- Look for path length limitations on your operating system
- Review hierarchy conflict warnings in console

**📱 Plugin Loading Issues**:
- Ensure the plugin folder is in `.obsidian/plugins/second-brAIn/`
- Check that "Community plugins" is enabled in Obsidian
- Look for errors in Developer Console (Ctrl+Shift+I → Console)
- Verify all dependencies are installed with `npm install`

**⏱️ Performance Issues**:
- Large content may take 30-60 seconds to process
- YouTube videos with long transcripts require additional time
- Check your internet connection and API response times
- Monitor console logs for processing bottlenecks

### Getting Help
- 📖 Check the [GitHub Issues](https://github.com/surendranb/second-brAIn/issues) for known problems
- 💬 Join discussions in [GitHub Discussions](https://github.com/surendranb/second-brAIn/discussions)
- 🔍 Enable detailed logging in Developer Console for debugging
- 📝 Include console logs when reporting issues

## Privacy & Security

- 🔒 Your API keys are stored locally in Obsidian settings only
- 🌐 Content is processed through your chosen AI provider (review their privacy policies)
- 💾 No personal data is stored on external servers beyond API processing
- 🏠 All notes and knowledge maps remain in your local Obsidian vault
- 🛡️ Hierarchy information is stored locally in your vault's hierarchy.json

## API Providers

### Google Gemini (Recommended)
- **Free tier available** with generous limits
- **Latest models**: gemini-2.0-flash, gemini-1.5-pro
- **Excellent reasoning** for knowledge organization
- **Setup**: [Google AI Studio](https://ai.google.dev/)

### OpenRouter
- **Multiple model access** including GPT-4, Claude, and others
- **Pay-per-use pricing** with transparent costs
- **Native JSON mode** support for better reliability
- **Setup**: [OpenRouter](https://openrouter.ai/)

## Contributing

We welcome contributions! Areas where you can help:
- 🐛 **Bug Reports**: Detailed issues with console logs
- 💡 **Feature Requests**: New capabilities and improvements
- 📝 **Documentation**: Better guides and examples
- 🧪 **Testing**: Try edge cases and report findings
- 💻 **Code**: PRs for fixes and enhancements

See [Contributing Guidelines](CONTRIBUTING.md) for details.

## Roadmap

- 🔄 **Real-time Knowledge Sync**: Live updates to knowledge maps
- 🎯 **Advanced Learning Paths**: Personalized knowledge progression
- 🔗 **Enhanced Cross-References**: Deeper semantic linking
- 📊 **Knowledge Analytics**: Insights into your learning patterns
- 🤝 **Collaborative Features**: Shared knowledge hierarchies

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built for knowledge workers who want to learn faster, think deeper, and organize smarter.**

Transform your information consumption into intelligent knowledge building with brAIn.
