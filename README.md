# 🧠 Axiom

> **The Multi-Pass Neural Agent for your Obsidian Knowledge Graph.**

[![GitHub Version](https://img.shields.io/badge/version-0.1.0-indigo.svg)](https://github.com/surendranb/second-brAIn)
[![Obsidian Support](https://img.shields.io/badge/obsidian-v1.4.0+-teal.svg)](https://obsidian.md)
[![Powered by](https://img.shields.io/badge/AI-Gemini%203-blue.svg)](https://deepmind.google/technologies/gemini/)

**Axiom** is an autonomous agentic pipeline designed to extract, synthesize, and organize knowledge from YouTube and Web articles directly into your Obsidian vault.

---

## 📸 The Experience

![Axiom Feature Showcase](https://raw.githubusercontent.com/surendranb/second-brAIn/main/assets/showcase.png)
*Real-time usage tracking, granular progress monitoring, and automatic hierarchical organization.*

---

## 🚀 Key Features

### 🌊 5-Pass Neural Synthesis
Axiom uses a multi-agent waterfall to synthesize knowledge across 5 distinct layers:
- **Layer 1: Structural Taxonomy**: Identifies core entities, bylines, and technical metadata.
- **Layer 2: Conceptual Deep-Dive**: Isolates the "load-bearing" ideas and technical frameworks.
- **Layer 3: Dialectical Perspectives**: Reconciles diverse examples, counter-arguments, and edge cases.
- **Layer 4: Semantic Connections**: Maps the content to your existing knowledge graph and real-world apps.
- **Layer 5: Generative Learning**: Crafts actionable paths, retrieval-augmented Q&A, and follow-up prompts.

### 📁 Hierarchical Organization
Axiom doesn't just create notes; it builds a structured knowledge graph. Based on the AI's taxonomy analysis, notes are automatically filed into deep hierarchies with corresponding Maps of Content (MOCs):

```text
MOCs/
├── Biology/
│   └── Cell Biology/
│       └── 00-Cell Biology MOC.md
├── Business/
│   ├── Entrepreneurship/
│   ├── Finance & Investment/
│   ├── Leadership/
│   └── Marketing/
└── Venture Capital/
    ├── 00-Venture Capital MOC.md
    └── ...
```

### ⚖️ Precision Tokenomics
- **Usage Heartbeats**: Visual feedback for token count and cost increments for every pass.
- **Tiered Pricing**: Accurately tracks costs across modern model tiers (Flash, Pro).
- **Atomic Recording**: Usage is persisted immediately after every pass to ensure accurate tracking.

---

## ⚙️ Quick Start (Manual Install)

1. **Clone**: Run the following in your vault's `.obsidian/plugins/` directory:
   ```bash
   git clone https://github.com/surendranb/second-brAIn Axiom
   ```
2. **API Key**: Get your API key from the [Google AI Studio](https://aistudio.google.com/app/apikey).
3. **Configure**: Enable the plugin in Obsidian settings, enter your key, and select your model.
4. **Execute**: Open the Axiom sidebar, paste a URL, and click **Summarize & Organize**.

---

## 💡 Intelligence Controls

Axiom supports custom prompt overrides via your vault. Create Markdown templates at:
- `YourVault/.Axiom/prompts/[intent]/[stage].md`

The agent will prioritize your local prompts over the internal defaults.

---

## 🛠️ Tech Stack
- **Environment**: Obsidian (Desktop & Mobile)
- **Intelligence**: Gemini 3 / Gemma 4
- **Extraction**: `yt-dlp` + `readability.js`
- **Styling**: Vanilla CSS

---

**License**: MIT
