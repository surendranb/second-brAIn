export const DEFAULT_SUMMARIZATION_PROMPT = `You are an expert knowledge architect, skilled at transforming information into learning-optimized insights for a second brain. Your goal is to create a comprehensive and well-structured note that serves as a building block in a knowledge scaffolding system.

For each section below, provide detailed and thoughtful content:

CONTEXT:
- Provide the background and setting of the content
- Explain why this information matters in the broader learning context
- Set up the framework for understanding the content

FACTS:
- Extract key factual information
- Include specific data points, statistics, or concrete information
- Focus on verifiable and objective information

PERSPECTIVES:
- Present different viewpoints on the topic
- Include contrasting opinions or approaches
- Consider cultural, historical, or theoretical perspectives

INSIGHTS:
- Identify deeper meanings and implications
- Connect ideas to broader concepts and learning paths
- Highlight patterns and relationships that support knowledge building

PERSONAL REFLECTION:
- Share your thoughts on the content
- Connect it to existing knowledge frameworks
- Identify personal relevance and applications

ANALOGIES AND METAPHORS:
- Create clear comparisons to explain complex ideas
- Use relatable examples to illustrate concepts
- Draw parallels to familiar situations that aid understanding

QUESTIONS AND CURIOSITIES:
- List important questions that arise
- Identify areas that need further exploration
- Note interesting points that deserve deeper investigation

APPLICATIONS AND EXAMPLES:
- Provide concrete examples of how to apply the information
- Show real-world applications
- Include specific use cases

CONTRASTS AND COMPARISONS:
- Compare with similar concepts or ideas
- Highlight differences and similarities
- Show how this fits into the broader knowledge structure

IMPLICATIONS:
- Discuss potential impacts and consequences
- Consider short-term and long-term effects
- Explore possible future developments

KNOWLEDGE GAPS:
- Identify areas where more information is needed
- Note assumptions that should be verified
- List topics that require further research

NEXT STEPS:
- Suggest specific actions to take
- Outline a plan for implementation
- Recommend follow-up learning activities

RELATED GOALS:
- Connect to personal or professional learning objectives
- Identify how this information supports larger goals
- Suggest ways to integrate this knowledge into existing learning paths

Please structure your response with clear sections, using bullet points for lists and maintaining a professional yet engaging tone. Focus on creating actionable insights that serve as building blocks in a larger knowledge architecture.`;

export const HIERARCHY_ANALYSIS_PROMPT = `Analyze the following content and determine the optimal knowledge hierarchy placement for learning architecture. Focus on building pedagogically sound knowledge scaffolding rather than simple categorization.

CRITICAL HIERARCHY PRINCIPLES:

1. **LEARNING STRUCTURE FOCUS**: Organize for optimal knowledge building, not just categorization
2. **ATOMIC FINAL LEVEL**: The most specific level must represent a SINGLE, coherent concept
3. **PEDAGOGICAL SOUNDNESS**: Each level should represent a logical learning progression (foundations → applications)
4. **ACADEMIC RIGOR**: Maintain proper conceptual relationships and domain accuracy

Please respond with ONLY a JSON object in this exact format:

{
    "hierarchy": {
        "level1": "Knowledge Domain (e.g., Computer Science, Physics, Business, Philosophy, etc.)",
        "level2": "Learning Area within the domain (e.g., Machine Learning, Quantum Mechanics, Marketing, Ethics)",
        "level3": "Specific Topic (optional - only if content warrants deeper categorization)",
        "level4": "Single Key Concept (optional - final atomic concept level)"
    },
    "learning_context": {
        "prerequisites": ["Foundational Concept 1", "Foundational Concept 2"],
        "related_concepts": ["Related Topic 1", "Related Topic 2"],
        "learning_path": ["Progressive Step 1", "Progressive Step 2", "Progressive Step 3"],
        "complexity_level": "beginner|intermediate|advanced",
        "estimated_reading_time": "X minutes"
    }
}

HIERARCHY GUIDELINES:

**Level 1 (Domain)**: Broad academic or practical domain
- Examples: "Computer Science", "Business", "Physics", "Philosophy"
- Should represent a major field of study or practice

**Level 2 (Area)**: Specific learning area within the domain  
- Examples: "Machine Learning", "Management", "Quantum Mechanics", "Ethics"
- Should represent a coherent subdiscipline or practice area

**Level 3 (Topic)**: Specific topic within the area (optional)
- Examples: "Neural Networks", "Organizational Behavior", "Wave Functions"
- Use ONLY when content focuses on a specific, well-defined topic
- Must be more specific than Level 2 but broader than Level 4

**Level 4 (Concept)**: Single atomic concept (optional)
- Examples: "Future of Work", "Cartography", "Backpropagation"
- Use ONLY when content focuses on ONE specific concept
- Must be atomic - NOT compound concepts like "AI & Future of Work"
- Should be the natural container for this specific content

LEARNING CONTEXT GUIDELINES:

**Prerequisites**: What foundational knowledge is needed?
- Focus on concepts learners should understand BEFORE this content
- Avoid listing advanced concepts as prerequisites
- Think: "What do I need to know first?"

**Related Concepts**: What connects to this content?
- Topics that share conceptual relationships
- Cross-domain connections that enrich understanding
- Concepts that would benefit from being studied together

**Learning Path**: Progressive sequence for mastery
- Start with foundational concepts
- Build toward more complex applications
- End with advanced or specialized topics

**Complexity Assessment**:
- Beginner: Introductory, requires minimal prerequisites
- Intermediate: Builds on existing knowledge, moderate depth
- Advanced: Requires substantial background, high cognitive load

Remember: The goal is to create a learning architecture that helps users build knowledge systematically, not just organize content for storage.`;

export const ENHANCED_SUMMARIZATION_PROMPT = `${DEFAULT_SUMMARIZATION_PROMPT}

Please structure your response as a JSON object with the following format:

{
    "title": "Your concise, descriptive title here",
    "metadata": {
        "speakers": ["Speaker 1", "Speaker 2"],
        "topics": ["Topic 1", "Topic 2", "Topic 3"],
        "tags": ["#tag1", "#tag2", "#tag3"],
        "related": ["Concept 1", "Concept 2", "Concept 3"]
    },
    "hierarchy": {
        "level1": "Knowledge Domain (e.g., Computer Science, Physics, Business, Philosophy, etc.)",
        "level2": "Learning Area within the domain (e.g., Machine Learning, Quantum Mechanics, Marketing, Ethics)",
        "level3": "Specific Topic (only if content focuses on a specific, well-defined topic)",
        "level4": "Single Key Concept (only if content focuses on ONE specific atomic concept)"
    },
    "learning_context": {
        "prerequisites": ["Foundational Concept 1", "Foundational Concept 2"],
        "related_concepts": ["Related Topic 1", "Related Topic 2"],
        "learning_path": ["Progressive Step 1", "Progressive Step 2", "Progressive Step 3"],
        "complexity_level": "beginner|intermediate|advanced",
        "estimated_reading_time": "5-10 minutes"
    },
    "sections": {
        "context": "Background and setting of the content",
        "facts": [
            "Key fact 1",
            "Key fact 2",
            "Key fact 3"
        ],
        "perspectives": [
            "Different viewpoint 1",
            "Different viewpoint 2"
        ],
        "insights": [
            "Important insight 1",
            "Important insight 2",
            "Important insight 3"
        ],
        "personal_reflection": "Your thoughts and connections to existing knowledge",
        "analogies": [
            "Analogy 1",
            "Analogy 2"
        ],
        "questions": [
            "Question 1",
            "Question 2"
        ],
        "applications": [
            "Application 1",
            "Application 2"
        ],
        "contrasts": [
            "Contrast 1",
            "Contrast 2"
        ],
        "implications": [
            "Implication 1",
            "Implication 2"
        ],
        "knowledge_gaps": [
            "Gap 1",
            "Gap 2"
        ],
        "next_steps": [
            "Action 1",
            "Action 2"
        ],
        "related_goals": [
            "Goal 1",
            "Goal 2"
        ]
    }
}

CRITICAL HIERARCHY ANALYSIS:

**FOCUS ON LEARNING ARCHITECTURE**: Organize for optimal knowledge building and pedagogical progression, not just content categorization.

**ATOMIC FINAL LEVEL PRINCIPLE**: The most specific level (level3 or level4) must represent a SINGLE, coherent concept that naturally contains this content.

Examples of GOOD atomic final levels:
✅ "Future of Work" (single concept)
✅ "Cartography" (single discipline)  
✅ "Neural Networks" (single technology)

Examples of BAD compound final levels:
❌ "AI & Future of Work" (two concepts)
❌ "Mathematics & Cartography" (mixing discipline and application)
❌ "Business and Technology" (too broad, multiple domains)

**LEARNING PROGRESSION FOCUS**:
- Level 1: Academic/practical domain that provides foundation
- Level 2: Learning area that builds on domain knowledge  
- Level 3: Specific topic within the area (optional)
- Level 4: Single atomic concept (optional)

**QUALITY GUIDELINES**:
- Each level should represent a logical learning step
- Prerequisites should be foundational, not advanced
- Learning paths should be progressive and buildable
- The hierarchy should help users understand "what to learn next"

Note: For sections with checkboxes (questions, knowledge_gaps, next_steps, related_goals), the items will be automatically formatted as checkboxes in the final note.`; 