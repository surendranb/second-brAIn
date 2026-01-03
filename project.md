# Project Context: brAIn (Second Brain Plugin)

## The Why (Strategic Intent)
Core move in the "Knowledge Engineering" game. The goal is to solve the problem of "information indigestion" by building a system that automatically transforms raw web content and videos into structured, hierarchical knowledge within Obsidian. Aligns with the North Star by accelerating learning and improving information metabolism.

## The What (Proof of Play)
An AI-powered Obsidian plugin that uses a 5-pass analysis system to process URLs. It creates structured notes and maintains a hierarchical Map of Contents (MOC) system.

## Next Steps (State of Play)
- **Research Collection (Implemented):** Added dynamic UI for selecting/creating research topics and logic to file notes directly into topic folders (skipping deep MOC nesting) while maintaining graph links.
- **Refinement:** Fixed hierarchy description truncation (200 chars), cleaned up debug logging, and improved frontmatter metadata (promoted `author`/`speakers`).
- **Testing:** Validating the Research Collection user flow and file placement.

## Relationships
- **Library:** (Self-referential: Maintains the Obsidian library)
- **Share:** https://surendran.info/projects/brain
- **Repo:** https://github.com/surendranb/second-brAIn