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

export const HIERARCHY_ANALYSIS_PROMPT = `Analyze the following content and determine optimal knowledge hierarchy placement(s). CRITICAL: Detect if this content could legitimately belong in multiple domains (cross-domain content).

CROSS-DOMAIN DETECTION:
Look for content that could legitimately belong in multiple domains. Be LIBERAL in detection - when in doubt, flag as cross-domain. Examples:

**Technology Topics:**
- "AI/ML applications" → Computer Science (AI), Business (Digital Transformation), Industry-specific domains
- "Semiconductors" → Chemistry (Materials), Physics (Solid State), Technology (Electronics)
- "Cybersecurity" → Computer Science (Security), Business (Risk Management), Law (Privacy)

**Business/Science Overlap:**
- "Behavioral economics" → Psychology (Behavior), Economics (Markets), Business (Decision Making)
- "Data analysis" → Statistics (Analysis), Computer Science (Data Science), Business (Analytics)
- "Climate change" → Environmental Science, Economics (Policy), Technology (Green Tech)

**Interdisciplinary Content:**
- Health + Technology, Education + AI, Finance + Psychology, etc.

**Content Types Often Cross-Domain:**
- Industry applications of technology
- Scientific concepts with business implications  
- Emerging technologies with social impact
- Policy topics affecting multiple sectors
- Research with practical applications

**Detection Threshold:** If content mentions multiple domains OR could be useful in multiple fields, flag as cross-domain. Err on the side of giving users choice.

CRITICAL HIERARCHY PRINCIPLES:

1. **LEARNING STRUCTURE FOCUS**: Organize for optimal knowledge building, not just categorization
2. **ATOMIC FINAL LEVEL**: The most specific level must represent a SINGLE, coherent concept
3. **PEDAGOGICAL SOUNDNESS**: Each level should represent a logical learning progression (foundations → applications)
4. **ACADEMIC RIGOR**: Maintain proper conceptual relationships and domain accuracy
5. **CROSS-DOMAIN AWARENESS**: Identify when content legitimately spans multiple domains

Please respond with ONLY a JSON object in this exact format:

{
    "is_cross_domain": true/false,
    "confidence_score": 0.0-1.0,
    "primary_hierarchy": {
        "level1": "Primary Knowledge Domain",
        "level2": "Primary Learning Area",
        "level3": "Specific Topic (optional)",
        "level4": "Single Key Concept (optional)",
        "reasoning": "Why this is the primary placement"
    },
    "alternative_hierarchies": [
        {
            "level1": "Alternative Domain",
            "level2": "Alternative Learning Area", 
            "level3": "Specific Topic (optional)",
            "level4": "Single Key Concept (optional)",
            "reasoning": "Why this is also valid",
            "strength": 0.0-1.0
        }
    ],
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

**ALWAYS PROVIDE ALTERNATIVES**: Even for seemingly single-domain content, consider alternative valid placements. Most content can be organized in multiple valid ways depending on learning goals and context. Examples:
- A Python tutorial could go in: Computer Science > Programming OR Professional Development > Technical Skills
- A leadership article could go in: Business > Management OR Psychology > Social Behavior

Remember: The goal is to create a learning architecture that helps users build knowledge systematically, not just organize content for storage. Give users meaningful choice in how they structure their knowledge.`;

export const ENHANCED_SUMMARIZATION_PROMPT = `You are an expert knowledge architect creating learning-focused notes. Structure your response as a JSON object with this EXACT format:

{
    "title": "Clear, descriptive title",
    "metadata": {
        "speakers": ["Speaker 1", "Speaker 2"],
        "topics": ["Topic 1", "Topic 2"],
        "tags": ["#tag1", "#tag2"],
        "related": ["Related Concept 1", "Related Concept 2"]
    },
    "hierarchy": {
        "level1": "Knowledge Domain (e.g., Computer Science, Business, Physics)",
        "level2": "Learning Area (e.g., Machine Learning, Management, Quantum Mechanics)",
        "level3": "Specific Topic (optional)",
        "level4": "Single Atomic Concept (optional)"
    },
    "learning_context": {
        "prerequisites": ["Foundation 1", "Foundation 2"],
        "related_concepts": ["Related 1", "Related 2"],
        "learning_path": ["Step 1", "Step 2", "Step 3"],
        "complexity_level": "beginner|intermediate|advanced",
        "estimated_reading_time": "X minutes"
    },
    "sections": {
        "context": "Background and setting",
        "facts": ["Fact 1", "Fact 2", "Fact 3"],
        "perspectives": ["Perspective 1", "Perspective 2"],
        "insights": ["Insight 1", "Insight 2"],
        "personal_reflection": "Your thoughts and connections",
        "analogies": ["Analogy 1", "Analogy 2"],
        "questions": ["Question 1", "Question 2"],
        "applications": ["Application 1", "Application 2"],
        "contrasts": ["Contrast 1", "Contrast 2"],
        "implications": ["Implication 1", "Implication 2"],
        "knowledge_gaps": ["Gap 1", "Gap 2"],
        "next_steps": ["Action 1", "Action 2"],
        "related_goals": ["Goal 1", "Goal 2"]
    }
}

CRITICAL HIERARCHY RULES:
- Focus on LEARNING PROGRESSION not just categorization
- Final level must be ATOMIC (single concept only)
- Good: "Future of Work", "Cartography", "Neural Networks"  
- Bad: "AI & Future of Work", "Math & Cartography"
- Each level should enable learning scaffolding

🚨 CRITICAL JSON REQUIREMENTS:
1. Your response MUST be ONLY valid JSON - no explanations, no markdown, no extra text
2. Start with { and end with } - nothing else
3. Use double quotes for ALL strings
4. No trailing commas
5. No comments in JSON
6. If you add explanations, the system will FAIL

EXAMPLE RESPONSE FORMAT:
{"title":"Example Title","metadata":{"speakers":[],"topics":["Example Topic"],"tags":["#example"],"related":[]},"hierarchy":{"level1":"Computer Science","level2":"Programming"},"learning_context":{"prerequisites":[],"related_concepts":[],"learning_path":["Programming Basics"],"complexity_level":"beginner","estimated_reading_time":"5 minutes"},"sections":{"context":"Example context","facts":["Example fact"],"insights":["Example insight"],"personal_reflection":"Example reflection","questions":["Example question?"],"applications":["Example application"],"next_steps":["Example step"],"related_goals":["Example goal"]}}`; 