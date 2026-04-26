# 🧠 brAIn

> **The Multi-Pass Neural Agent for your Obsidian Knowledge Graph.**

[![GitHub Version](https://img.shields.io/badge/version-0.1.0-indigo.svg)](https://github.com/surendranb/second-brAIn)
[![Obsidian Support](https://img.shields.io/badge/obsidian-v1.4.0+-teal.svg)](https://obsidian.md)
[![Powered by](https://img.shields.io/badge/AI-Gemini%203-blue.svg)](https://deepmind.google/technologies/gemini/)

**brAIn** is an autonomous agentic pipeline designed to extract, synthesize, and organize high-fidelity knowledge from YouTube and Web articles directly into your Obsidian vault. 

---

## 📸 The Experience

![brAIn Feature Showcase](https://raw.githubusercontent.com/surendranb/second-brAIn/main/assets/screenshot_mockup.png)
*Glassmorphic dashboard with real-time usage tracking and granular progress monitoring.*

---

## 🚀 Core Value Proposition

### 1. 🌊 5-Pass Neural Synthesis
brAIn uses a multi-agent waterfall to synthesize knowledge across 5 distinct layers:
- **Layer 1: Structural Taxonomy**: Identifies core entities, bylines, and technical metadata.
- **Layer 2: Conceptual Deep-Dive**: Isolates the "load-bearing" ideas and technical frameworks.
- **Layer 3: Dialectical Perspectives**: Reconciles diverse examples, counter-arguments, and edge cases.
- **Layer 4: Semantic Connections**: Maps the content to your existing knowledge graph and real-world apps.
- **Layer 5: Generative Learning**: Crafts actionable paths, retrieval-augmented Q&A, and follow-up prompts.

### 2. ⚡ Native Performance
- **High-Performance Extraction**: Built with a native bridge for YouTube and Web parsing, eliminating external scripting dependencies.
- **Low-Latency Logic**: Optimized for the latest Gemini and Gemma series models.

### 3. ⚖️ Precision Tokenomics
- **Real-time Heartbeats**: Visual feedback for token count and cost increments for every pass.
- **Tiered Pricing**: Accurately tracks costs across modern model tiers.
- **Atomic Recording**: Usage is persisted immediately after every pass to ensure foolproof tracking.

---

## ⚙️ Quick Start

1. **Install**: Clone this repo into your vault's `.obsidian/plugins/` folder.
2. **API Key**: Get your API key from the [Google AI Studio](https://aistudio.google.com/app/apikey).
3. **Configure**: Enter your key in the brAIn settings tab.
4. **Execute**: Open the brAIn sidebar, paste a URL, and click **Summarize & Organize**.

---

## 💡 Intelligence Controls

brAIn supports custom prompt overrides via your vault. Create Markdown templates at:
- `YourVault/.brAIn/prompts/[intent]/[stage].md`

The agent will prioritize your local prompts over the internal defaults.

---

## 🛠️ Tech Stack
- **Environment**: Obsidian (Desktop & Mobile ready)
- **Language**: TypeScript
- **Intelligence**: Gemini 3 / Gemma 4
- **Extraction**: `yt-dlp` (Native Bridge) + `readability.js`
- **Styling**: Vanilla CSS

---

**License**: MIT
