/**
 * Processing intent configurations
 * Extracted from main.ts for better modularity
 */

export type ProcessingIntent = 'knowledge_building' | 'event_documentation' | 'quick_reference' | 'research_collection' | 'professional_intelligence' | 'personal_development' | 'news_events' | 'inspiration_capture' | 'how_to';

export interface ProcessingIntentOption {
    id: ProcessingIntent;
    name: string;
    description: string;
}

// Processing Intent Options
export const PROCESSING_INTENTS: ProcessingIntentOption[] = [
    {
        id: 'knowledge_building',
        name: 'Knowledge Building',
        description: 'Deep learning and understanding'
    },
    {
        id: 'event_documentation',
        name: 'Event Documentation',
        description: 'Record what happened for future reference'
    },
    {
        id: 'quick_reference',
        name: 'Quick Reference',
        description: 'Extract actionable information for immediate use'
    },
    {
        id: 'research_collection',
        name: 'Research Collection',
        description: 'Gather information for a specific project'
    },
    {
        id: 'professional_intelligence',
        name: 'Professional Intelligence',
        description: 'Stay current in your field/industry'
    },
    {
        id: 'personal_development',
        name: 'Personal Development',
        description: 'Self-improvement and habit formation'
    },
    {
        id: 'news_events',
        name: 'News & Current Events',
        description: 'Stay informed and track developments'
    },
    {
        id: 'inspiration_capture',
        name: 'Inspiration Capture',
        description: 'Preserve creative ideas and inspiration'
    },
    {
        id: 'how_to',
        name: 'How To / Tutorial',
        description: 'Step-by-step guides and tutorials organized by topic'
    }
];