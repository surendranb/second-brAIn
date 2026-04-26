# brAIn 🧠
### The Agentic Librarian for your Second Brain

**brAIn** is a high-fidelity knowledge extraction and organization engine for Obsidian. It doesn't just "summarize"—it performs a deep, 5-pass neural analysis of web content and YouTube videos, then intelligently integrates them into your personal knowledge hierarchy.

---

## 🚀 What Makes brAIn Different?

Most plugins simply feed a transcript to an LLM and call it a day. **brAIn** treats information like a librarian:

- 🎭 **5-Pass Neural Analysis**: Every piece of content undergoes a rigorous multi-stage interrogation (Structure → Content → Perspectives → Examples → Connections → Learning).
- 🏗️ **Native Semantic Extraction**: No Python required. No background processes. No `venv`. Uses a high-performance native binary bridge for YouTube and `@mozilla/readability` for the web.
- 📂 **Vault-Native Control**: Want to change how the AI thinks? Just edit a Markdown file. Override any stage of the AI logic via `.brAIn/prompts/[intent]/[stage].md`.
- 🪙 **Precision Tokenomics**: Native integration with Google's `countTokens` API gives you real-time cost transparency and "Pre-flight" usage predictions.

---

## 🛠️ The 5-Pass Analysis Pipeline

1. **Structure & Metadata**: Optimizes the title and determines the "Truest Semantic Home" in your vault.
2. **Content Deep-Dive**: Extracts core concepts, key facts, and builds a comprehensive synthesis.
3. **Perspectives & Examples**: Identifies analogies, real-world examples, and critiques the content.
4. **Connections & Synthesis**: Links the new information to your existing knowledge areas.
5. **Learning & Roadmap**: Identifies knowledge gaps and suggests actionable next steps.

---

## ⚡ Quick Start

### 1. Installation
- Install **brAIn** from the Obsidian Community Plugins (or clone this repo into your `.obsidian/plugins/` folder).
- Ensure you have **Node.js** installed on your system (for the YouTube binary bridge).

### 2. Configure Your LLM
- Go to **Settings > brAIn**.
- Enter your **Google Gemini API Key** (Get one free at [Google AI Studio](https://ai.google.dev/)).
- Recommended Model: `Gemini 1.5 Flash` (Fast, cheap, and massive context window).

### 3. Start Building Knowledge
- Click the **brAIn icon** in your ribbon.
- Paste a URL (YouTube, Blog, Research Paper).
- Watch the **Activity Log** as the AI performs its multi-pass analysis in real-time.

---

## 📂 Intelligent Organization

brAIn doesn't just dump files into a folder. It builds a **Domain → Area → Topic → Concept** hierarchy:

```text
📁 Knowledge (Vault Root)
  📁 Computer Science (Domain)
    📁 Artificial Intelligence (Area)
      📁 Neural Networks (Topic)
        📄 Transformer Architecture.md
        📄 Attention Mechanisms.md
```

The AI analyzes your *existing* folder structure before creating new paths, ensuring your vault remains a clean, organized garden.

---

## 🔒 Privacy & Local-First

- **Your Data stays yours**: All transcripts and analysis are stored as standard Markdown files in your vault.
- **Direct Extraction**: Content is pulled directly from your device, not a middle-man server.
- **OTel Ready**: Built on standard OpenTelemetry principles for easy integration with local tracing tools like **Arize Phoenix**.

---

## 📝 Troubleshooting & Requirements

- **YouTube Extraction**: Requires `Node.js` to be accessible in your system path.
- **Mobile Support**: Fully supported on iOS and Android for web extraction (YouTube extraction currently limited to Desktop).
- **API Limits**: If you see `429: Too Many Requests`, Google is rate-limiting you. Try switching to a different model or waiting a few minutes.

---

Built with ❤️ for the Obsidian community.
**Transform your information consumption into intelligent knowledge building.**
