# 🧠 brAIn

> **The Multi-Pass Neural Agent for your Obsidian Knowledge Graph.**

[![GitHub Version](https://img.shields.io/badge/version-0.1.0-indigo.svg)](https://github.com/surendranb/second-brAIn)
[![Obsidian Support](https://img.shields.io/badge/obsidian-v1.4.0+-teal.svg)](https://obsidian.md)
[![Powered by](https://img.shields.io/badge/AI-Gemini%201.5-blue.svg)](https://deepmind.google/technologies/gemini/)

**brAIn** is not a summarizer. It is an autonomous agentic pipeline designed to extract, synthesize, and organize high-fidelity knowledge from YouTube and Web articles directly into your Obsidian vault. Built for the elite knowledge worker, it replaces brittle Python scripts with a 100% native, high-performance TypeScript engine.

---

## 📸 The Experience

![brAIn Feature Showcase](https://raw.githubusercontent.com/surendranb/second-brAIn/main/assets/screenshot_mockup.png)
*A high-contrast, glassmorphic dashboard featuring real-time "Usage Heartbeats" and granular progress tracking.*

---

## 🚀 Core Value Proposition

### 1. 🌊 5-Pass Neural Synthesis
Traditional AI summaries are flat. brAIn uses a state-of-the-art multi-agent waterfall to synthesize knowledge across 5 distinct layers:
- **Layer 1: Structural Taxonomy**: Identifies core entities, bylines, and technical metadata.
- **Layer 2: Conceptual Deep-Dive**: Isolates the "load-bearing" ideas and technical frameworks.
- **Layer 3: Dialectical Perspectives**: Reconciles diverse examples, counter-arguments, and edge cases.
- **Layer 4: Semantic Connections**: Maps the content to your existing knowledge graph and real-world apps.
- **Layer 5: Generative Learning**: Crafts actionable paths, retrieval-augmented Q&A, and follow-up prompts.

### 2. ⚡ 100% Native & Python-Free
The "Refactor Path" has eliminated all local Python requirements. 
- **Native YouTube Bridge**: Powered by a hardened `yt-dlp` binary with built-in signature solvers and stealth headers to bypass 429 blocks.
- **High-Fidelity Web Parsing**: Uses Mozilla’s `Readability` engine to strip the noise and deliver pristine Markdown signals.

### 3. ⚖️ Precision Tokenomics
Stop guessing your AI costs. brAIn provides an authoritative usage dashboard:
- **Real-time Heartbeats**: See the token count and estimated cost increase with every pass.
- **Tiered Pricing**: Accurately tracks costs across **Gemini Pro**, **Flash**, and **Flash-Lite** tiers.
- **Atomic Recording**: Usage is saved immediately after every pass—never lose a penny to a crash.

---

## ⚙️ Quick Start (30 Seconds)

1. **Install**: Clone this repo into your vault's `.obsidian/plugins/` folder.
2. **API Key**: Get a free [Google AI Studio Key](https://aistudio.google.com/app/apikey).
3. **Configure**: Enter your key in the brAIn settings tab and select your model (Default: `gemini-flash-lite-latest`).
4. **Execute**: Open the brAIn sidebar, paste a URL, and click **Summarize & Organize**.

---

## 💡 Intelligence Controls (Advanced)

brAIn honors the "Local-First" philosophy. You can override the AI's logic by creating your own prompt templates:
- `YourVault/.brAIn/prompts/[intent]/[stage].md`

The agent will automatically prioritize your vault-native Markdown prompts over the internal defaults, allowing you to custom-tune the "Brain" to your specific ontology.

---

## 🛠️ Tech Stack
- **Runtime**: Obsidian (Electron / Node.js)
- **Language**: TypeScript
- **Intelligence**: Gemini 1.5 (Pro/Flash/Lite)
- **Extraction**: Native Binary Bridge (`yt-dlp`) + `readability.js`
- **Styling**: Vanilla CSS (Premium Glassmorphism)

---

## 👤 Author
Built with elite conviction by **Surendran**. 

*Every technical build is a proof of what is possible. Prioritize showing the "Impossible made Easy" over listing technical changelogs.*

---
**License**: MIT
