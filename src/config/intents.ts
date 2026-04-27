/**
 * Processing intent configurations
 * Extracted from main.ts for better modularity
 */

export type ProcessingIntent = 'knowledge_building' | 'event_documentation' | 'quick_reference' | 'research_collection' | 'professional_intelligence' | 'personal_development' | 'news_events' | 'inspiration_capture' | 'how_to' | 'verbatim_qa';

export interface ProcessingIntentOption {
    id: ProcessingIntent;
    name: string;
    description: string;
}

// Processing Intent Options
export const PROCESSING_INTENTS: ProcessingIntentOption[] = [
    {
        id: 'knowledge_building',
        name: 'Knowledge building',
        description: 'Deep learning and understanding'
    },
    {
        id: 'event_documentation',
        name: 'Event documentation',
        description: 'Record what happened for future reference'
    },
    {
        id: 'quick_reference',
        name: 'Quick reference',
        description: 'Extract actionable information for immediate use'
    },
    {
        id: 'research_collection',
        name: 'Research collection',
        description: 'Gather information for a specific project'
    },
    {
        id: 'professional_intelligence',
        name: 'Professional intelligence',
        description: 'Stay current in your field/industry'
    },
    {
        id: 'personal_development',
        name: 'Personal development',
        description: 'Self-improvement and habit formation'
    },
    {
        id: 'news_events',
        name: 'News and current events',
        description: 'Stay informed and track developments'
    },
    {
        id: 'inspiration_capture',
        name: 'Inspiration capture',
        description: 'Preserve creative ideas and inspiration'
    },
    {
        id: 'how_to',
        name: 'How-to / tutorial',
        description: 'Step-by-step guides and tutorials organized by topic'
    }
];