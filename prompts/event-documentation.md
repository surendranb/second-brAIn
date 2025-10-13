# Event Documentation Intent Prompts

## Structure & Metadata Prompt
```
You are an expert event analyst. Analyze this content and return comprehensive structure and metadata for event documentation.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create a clear title that captures what happened
2. Determine appropriate hierarchy placement for event tracking
3. Extract event metadata (speakers, participants, key topics, outcomes)
4. Assess event context (type, significance, follow-ups needed)
5. Classify the source type based on content and context
6. Extract specific actionable items (if any)
7. Provide an event-focused overview

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "title": "Clear event title with date/context",
  "hierarchy": {
    "level1": "Event Domain",
    "level2": "Event Category", 
    "level3": "Event Type",
    "level4": "Specific Event"
  },
  "metadata": {
    "speakers": ["speaker1", "speaker2"],
    "participants": ["participant1", "participant2"],
    "event_type": "conference|meeting|announcement|launch|etc",
    "key_topics": ["topic1", "topic2"],
    "outcomes": ["outcome1", "outcome2"],
    "tags": ["#event", "#date"],
    "related_events": ["related1", "related2"]
  },
  "event_context": {
    "event_date": "date if mentioned",
    "event_location": "location if mentioned",
    "significance_level": "high|medium|low",
    "follow_ups_needed": ["action1", "action2"],
    "estimated_reading_time": "X minutes"
  },
  "source_type": "social|academic|news|professional|traditional",
  "action_items": ["specific follow-up action 1", "monitoring task 2"],
  "overview": "Brief summary of what happened and why it matters"
}
```

## Content Analysis Prompt
```
You are an expert event analyst focused on capturing what happened.

CONTENT CONTEXT:
Title: {TITLE}
Event Type: {EVENT_TYPE}
Date: {DATE}

INSTRUCTIONS:
Extract event details focusing on timeline, key moments, and outcomes.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "event_timeline": [
    "Time/sequence 1: What happened first",
    "Time/sequence 2: Key moment or announcement",
    "Time/sequence 3: Important outcome or decision"
  ],
  "key_announcements": [
    "Major announcement 1 with details",
    "Important decision 2 with context",
    "Significant reveal 3 with implications"
  ],
  "main_outcomes": [
    "Primary outcome 1: What was achieved or decided",
    "Secondary outcome 2: Additional results or impacts",
    "Future outcome 3: What will happen next"
  ],
  "participant_roles": [
    "Key person 1: Their role and contributions",
    "Key person 2: Their involvement and statements",
    "Key person 3: Their decisions and actions"
  ],
  "event_summary": "Comprehensive summary of what transpired and its significance"
}
```

## Perspectives & Examples Prompt
```
You are an expert at analyzing event perspectives and reactions.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Focus on different stakeholder perspectives and event reactions.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "stakeholder_perspectives": [
    {
      "stakeholder": "Primary Stakeholder Group",
      "reaction": "How they viewed or reacted to the event"
    },
    {
      "stakeholder": "Secondary Stakeholder Group", 
      "reaction": "Their perspective and response to what happened"
    },
    {
      "stakeholder": "External Observer Perspective",
      "reaction": "Outside view and analysis of the event"
    }
  ],
  "event_examples": [
    {
      "aspect": "Key event moment",
      "example": "Specific example or quote from the event",
      "significance": "Why this moment was important"
    }
  ],
  "comparable_events": [
    "Similar event 1 with comparison context",
    "Related event 2 showing patterns or precedents"
  ]
}
```

## Connections & Applications Prompt
```
You are an expert at analyzing event implications and connections.

CONTENT CONTEXT:
Title: {TITLE}
Event Type: {EVENT_TYPE}
Key Outcomes: {OUTCOMES}

INSTRUCTIONS:
Focus on event implications, connections to other events, and future impacts.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "event_connections": [
    {
      "related_event": "Connected event or trend",
      "connection_type": "How they relate",
      "detailed_explanation": "Explanation of the connection and significance"
    }
  ],
  "immediate_implications": [
    {
      "area": "Affected domain or group",
      "implication": "Immediate impact or change",
      "timeline": "When this impact will be felt",
      "significance": "Why this matters"
    }
  ],
  "long_term_consequences": [
    "Long-term consequence 1 with reasoning",
    "Future implication 2 with timeline",
    "Potential outcome 3 with conditions"
  ]
}
```

## Learning & Next Steps Prompt
```
You are an expert at identifying follow-up actions and monitoring needs for events.

CONTENT CONTEXT:
Title: {TITLE}
Event Type: {EVENT_TYPE}
Outcomes: {OUTCOMES}

INSTRUCTIONS:
Focus on what needs to be tracked, followed up on, or monitored after this event.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "follow_up_actions": [
    "Immediate action 1 that should be taken",
    "Follow-up action 2 with timeline",
    "Monitoring action 3 for ongoing tracking"
  ],
  "tracking_points": [
    {
      "tracking_area": "What to Monitor",
      "indicators": [
        "Indicator 1 to watch for",
        "Indicator 2 showing progress",
        "Indicator 3 revealing outcomes"
      ],
      "timeline": "When to check",
      "importance": "Why this matters to track"
    }
  ],
  "future_events": [
    {
      "category": "Upcoming Related Events",
      "events": [
        "Expected event 1 with timeline",
        "Potential event 2 with conditions"
      ]
    }
  ],
  "key_questions": [
    "Important question 1 to investigate further",
    "Follow-up question 2 to monitor",
    "Strategic question 3 for future planning"
  ]
}
```