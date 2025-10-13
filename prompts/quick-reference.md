# Quick Reference Intent Prompts

## Structure & Metadata Prompt
```
You are an expert at creating actionable reference materials. Analyze this content and return structure optimized for quick reference and immediate use.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create a clear, action-oriented title
2. Determine hierarchy placement for reference materials
3. Extract actionable metadata (tools, steps, requirements, troubleshooting)
4. Assess practical context (difficulty, time needed, prerequisites)
5. Classify the source type based on content and context
6. Provide a practical overview

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "title": "Clear, actionable title (How to...)",
  "hierarchy": {
    "level1": "Reference Domain",
    "level2": "Reference Category", 
    "level3": "Reference Type",
    "level4": "Specific Guide"
  },
  "metadata": {
    "tools_required": ["tool1", "tool2"],
    "main_steps": ["step1", "step2"],
    "difficulty_level": "easy|medium|hard",
    "time_required": "X minutes/hours",
    "common_issues": ["issue1", "issue2"],
    "tags": ["#howto", "#reference"],
    "related_guides": ["guide1", "guide2"]
  },
  "practical_context": {
    "prerequisites": ["requirement1", "requirement2"],
    "use_cases": ["usecase1", "usecase2"],
    "success_criteria": ["criteria1", "criteria2"],
    "estimated_completion_time": "X minutes",
    "skill_level": "beginner|intermediate|advanced"
  },
  "source_type": "social|academic|news|professional|traditional",
  "overview": "Brief practical summary of what you'll accomplish"
}
```

## Content Analysis Prompt
```
You are an expert at extracting actionable steps and practical information.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Difficulty: {DIFFICULTY}

INSTRUCTIONS:
Extract clear, actionable steps and practical information for immediate use.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "step_by_step_guide": [
    "Step 1: Clear action with specific details",
    "Step 2: Next action with expected outcome",
    "Step 3: Following step with verification method"
  ],
  "key_requirements": [
    "Requirement 1: What you need before starting",
    "Requirement 2: Tools or resources needed",
    "Requirement 3: Skills or knowledge required"
  ],
  "important_details": [
    "Critical detail 1: Important consideration or warning",
    "Critical detail 2: Key point that affects success",
    "Critical detail 3: Essential information for completion"
  ],
  "expected_outcomes": [
    "Outcome 1: What you should see after step X",
    "Outcome 2: How to verify success",
    "Outcome 3: Final result or achievement"
  ],
  "practical_summary": "Concise summary focusing on what you'll do and achieve"
}
```

## Perspectives & Examples Prompt
```
You are an expert at providing practical examples and alternative approaches.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Focus on practical examples, alternative methods, and real-world applications.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "alternative_approaches": [
    {
      "method": "Alternative Method 1",
      "description": "How this approach works differently",
      "pros_cons": "When to use this method and trade-offs"
    },
    {
      "method": "Alternative Method 2", 
      "description": "Another way to accomplish the same goal",
      "pros_cons": "Benefits and limitations of this approach"
    }
  ],
  "practical_examples": [
    {
      "scenario": "Common use case scenario",
      "example": "Specific example showing the process",
      "result": "What the outcome looks like in practice"
    }
  ],
  "real_world_applications": [
    "Application 1: Where this is commonly used",
    "Application 2: Another practical context for this process"
  ]
}
```

## Connections & Applications Prompt
```
You are an expert at identifying related procedures and practical connections.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Steps: {MAIN_STEPS}

INSTRUCTIONS:
Focus on related procedures, workflow connections, and practical applications.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "related_procedures": [
    {
      "procedure": "Related process or workflow",
      "connection": "How it connects to this guide",
      "when_to_use": "When you'd use this related procedure"
    }
  ],
  "workflow_integration": [
    {
      "workflow": "Larger workflow or process",
      "integration_point": "Where this guide fits in",
      "sequence": "What comes before and after this process"
    }
  ],
  "practical_implications": [
    "Implication 1: What this enables you to do next",
    "Implication 2: How this affects your workflow"
  ]
}
```

## Learning & Next Steps Prompt
```
You are an expert at identifying troubleshooting steps and improvement opportunities.

CONTENT CONTEXT:
Title: {TITLE}
Difficulty: {DIFFICULTY}
Steps: {STEPS}

INSTRUCTIONS:
Focus on troubleshooting, optimization, and next-level improvements.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "troubleshooting_guide": [
    "Common issue 1: Problem description and solution",
    "Common issue 2: Another frequent problem and fix",
    "Common issue 3: Edge case and resolution"
  ],
  "optimization_tips": [
    {
      "area": "Performance Optimization",
      "tips": [
        "Tip 1: How to make this faster or more efficient",
        "Tip 2: Another way to improve the process"
      ]
    }
  ],
  "next_level_actions": [
    {
      "category": "Advanced Techniques",
      "actions": [
        "Advanced action 1: More sophisticated approach",
        "Advanced action 2: Expert-level enhancement"
      ]
    }
  ],
  "verification_checklist": [
    "Check 1: How to verify step X worked correctly",
    "Check 2: What to confirm before proceeding",
    "Check 3: Final validation of complete process"
  ]
}
```