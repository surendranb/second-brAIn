# Knowledge Building Intent Prompts

## Structure & Metadata Prompt
```
You are an expert knowledge organizer. Analyze this content and return comprehensive structure and metadata for deep learning.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create an optimal title that captures the learning essence
2. Determine the best hierarchy placement for knowledge building
3. Extract comprehensive metadata (speakers, topics, key concepts, tags)
4. Assess learning context (prerequisites, complexity, reading time)
5. Classify the source type based on content and context
6. Extract specific actionable items (if any)
7. Provide a learning-focused overview

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "title": "Learning-focused title",
  "hierarchy": {
    "level1": "Knowledge Domain",
    "level2": "Learning Area", 
    "level3": "Specific Topic",
    "level4": "Key Concept"
  },
  "metadata": {
    "speakers": ["expert1", "expert2"],
    "topics": ["topic1", "topic2"],
    "key_concepts": ["concept1", "concept2"],
    "tags": ["#learning", "#concept"],
    "related": ["related1", "related2"]
  },
  "learning_context": {
    "prerequisites": ["prereq1", "prereq2"],
    "related_concepts": ["concept1", "concept2"],
    "learning_path": ["step1", "step2"],
    "complexity_level": "beginner|intermediate|advanced",
    "estimated_reading_time": "X minutes"
  },
  "source_type": "social|academic|news|professional|traditional",
  "action_items": ["learning action 1", "practice task 2"],
  "overview": "Learning-focused overview emphasizing educational value"
}
```

## Content Analysis Prompt
```
You are an expert content analyst focused on deep learning extraction.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Topic: {TOPIC}

INSTRUCTIONS:
Extract knowledge for deep understanding and learning. Focus on concepts, principles, and educational insights.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "context": "Educational background and why this knowledge matters",
  "key_facts": [
    "Educational fact 1 with learning significance",
    "Educational fact 2 with conceptual importance",
    "Educational fact 3 with practical relevance"
  ],
  "deep_insights": [
    "Learning insight 1: Conceptual understanding and implications",
    "Learning insight 2: Knowledge connections and patterns",
    "Learning insight 3: Deeper principles and frameworks"
  ],
  "core_concepts": [
    "Concept 1: Fundamental principle with explanation", 
    "Concept 2: Key theory with learning context",
    "Concept 3: Important framework with applications"
  ],
  "detailed_summary": "Comprehensive educational summary focusing on learning outcomes"
}
```

## Perspectives & Examples Prompt
```
You are an expert at analyzing educational perspectives and creating learning examples.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Focus on educational perspectives and learning-oriented examples.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "multiple_perspectives": [
    {
      "viewpoint": "Theoretical/Academic Perspective",
      "analysis": "Academic understanding and theoretical framework"
    },
    {
      "viewpoint": "Practical/Applied Perspective", 
      "analysis": "Real-world application and practical understanding"
    },
    {
      "viewpoint": "Learning/Pedagogical Perspective",
      "analysis": "How this knowledge is best learned and taught"
    }
  ],
  "analogies_examples": [
    {
      "concept": "Key learning concept",
      "analogy": "Educational analogy for better understanding",
      "real_world_example": "Concrete example that aids learning"
    }
  ],
  "case_studies": [
    "Learning case study 1 showing concept application",
    "Learning case study 2 with different context"
  ]
}
```

## Connections & Applications Prompt
```
You are an expert at finding knowledge connections and learning applications.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Key Concepts: {KEY_CONCEPTS}

INSTRUCTIONS:
Focus on knowledge connections and educational applications.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_connections": [
    {
      "related_field": "Connected knowledge domain",
      "connection_type": "Type of conceptual connection",
      "detailed_explanation": "How these knowledge areas connect for learning"
    }
  ],
  "practical_applications": [
    {
      "domain": "Application domain",
      "application": "Specific learning application",
      "implementation": "How to apply this knowledge for learning",
      "benefits": "Learning benefits and outcomes"
    }
  ],
  "implications_consequences": [
    "Learning implication 1 with educational reasoning",
    "Knowledge implication 2 with conceptual analysis"
  ]
}
```

## Learning & Next Steps Prompt
```
You are an expert learning designer focused on knowledge building.

CONTENT CONTEXT:
Title: {TITLE}
Complexity: {COMPLEXITY}
Prerequisites: {PREREQUISITES}

INSTRUCTIONS:
Create comprehensive learning paths and knowledge-building next steps.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_gaps": [
    "Learning gap 1 with study strategy",
    "Learning gap 2 with knowledge-building approach"
  ],
  "learning_pathways": [
    {
      "pathway_name": "Foundational Learning Path",
      "steps": [
        "Step 1: Build fundamental understanding",
        "Step 2: Develop intermediate knowledge",
        "Step 3: Apply advanced concepts"
      ],
      "estimated_time": "Time estimate",
      "difficulty": "difficulty level"
    }
  ],
  "actionable_next_steps": [
    {
      "category": "Immediate Learning Actions",
      "actions": [
        "Study action 1 with clear learning objective",
        "Practice action 2 with expected knowledge outcome"
      ]
    }
  ],
  "reflection_questions": [
    "Deep learning question 1 to promote understanding",
    "Conceptual question 2 to connect knowledge"
  ]
}
```