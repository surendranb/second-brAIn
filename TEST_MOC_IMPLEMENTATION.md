# MOC Implementation Test Guide

## Overview
This document explains how to test the newly implemented MOC (Map of Content) organization system.

## What Was Implemented

### Core Features
1. **Automatic MOC Creation**: When a new note is created, the system analyzes its content and automatically creates or updates the appropriate MOC
2. **Knowledge Hierarchy Detection**: Uses heuristic analysis to determine knowledge domains (Computer Science, Science, Business, etc.)
3. **Bidirectional Linking**: Notes are automatically linked to their MOCs and vice versa
4. **MOC Structure**: Organized folder structure under `MOCs/Domain/Topic.md`

### Technical Implementation
- **MOCManager**: Handles MOC file creation, updates, and directory management
- **HierarchyAnalyzer**: Analyzes content to determine knowledge domain and hierarchy
- **Integration**: Seamlessly integrated into existing note creation flow

## How to Test

### Prerequisites
1. Enable MOC functionality in plugin settings
2. Set MOC folder path (default: "MOCs")
3. Ensure you have an AI provider configured (Gemini or OpenRouter)

### Test Scenarios

#### Test 1: Computer Science Content
1. Create a note from a programming/tech URL (e.g., a YouTube video about Python)
2. Expected behavior:
   - Note created in `Summaries/` folder
   - MOC created at `MOCs/Computer Science/Programming.md` (or similar subdomain)
   - Note includes MOC metadata in frontmatter
   - MOC updated with link to the new note

#### Test 2: Science Content
1. Create a note from a science-related URL
2. Expected behavior:
   - MOC created at `MOCs/Science/[Subdomain].md`
   - Proper categorization based on content

#### Test 3: Business Content
1. Create a note from a business/entrepreneurship URL
2. Expected behavior:
   - MOC created at `MOCs/Business/[Subdomain].md`
   - Business-specific categorization

### Verification Steps

#### Check Note Structure
The created note should have frontmatter like:
```yaml
---
title: "Note Title"
date: "2024-01-01"
type: "summary"
source:
  type: "youtube"
  url: "https://..."
status: "draft"
created: "2024-01-01T00:00:00.000Z"
modified: "2024-01-01T00:00:00.000Z"
hierarchy:
  level1: "Computer Science"
  level2: "Programming"
  level3: "Python"
moc: "MOCs/Computer Science/Programming.md"
learning_context:
  prerequisites: []
  related_concepts: []
  learning_path: ["Programming"]
  complexity_level: "intermediate"
---
```

#### Check MOC Structure
The MOC file should look like:
```markdown
---
type: "moc"
title: "Programming"
domain: "Computer Science"
created: "2024-01-01T00:00:00.000Z"
updated: "2024-01-01T00:00:00.000Z"
tags: ["moc", "computer-science"]
note_count: 1
learning_paths: []
---

# Programming

## Learning Paths
- [[Python Learning Path]]

## Core Concepts
- [[Python]]

## Related Topics
<!-- Related topics will be added automatically -->

## Notes
- [[Your Note Title]]

---
*This MOC was automatically generated and will be updated as new notes are added.*
```

### Expected File Structure
After testing, you should see:
```
vault/
├── MOCs/
│   ├── Computer Science/
│   │   └── Programming.md
│   ├── Science/
│   │   └── [Science Topic].md
│   └── Business/
│       └── [Business Topic].md
└── Summaries/
    ├── Note 1.md
    ├── Note 2.md
    └── Note 3.md
```

## Troubleshooting

### Common Issues
1. **MOC not created**: Check if MOC functionality is enabled in settings
2. **Wrong categorization**: The heuristic analysis may need refinement for specific content
3. **File creation errors**: Check folder permissions and MOC folder path setting

### Debug Information
- Check browser console for detailed logs with `[MOCManager]` and `[CreateNote]` prefixes
- Verify settings are saved correctly
- Ensure AI provider is working for content analysis

## Next Steps
After successful testing, the implementation can be enhanced with:
1. AI-powered content analysis for better categorization
2. Learning path templates
3. Knowledge gap analysis
4. Advanced MOC relationships 