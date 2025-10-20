import { ProcessingIntent } from './main';

export interface PromptTemplate {
    role: string;
    instructions: string[];
    template: string;
    output_schema: Record<string, any>;
}

export interface IntentPrompts {
    structure: string;
    content: string;
    perspectives: string;
    connections: string;
    learning: string;
}

interface IntentPromptsJSON {
    intent: ProcessingIntent;
    version: string;
    prompts: {
        structure: PromptTemplate;
        content: PromptTemplate;
        perspectives: PromptTemplate;
        connections: PromptTemplate;
        learning: PromptTemplate;
    };
}

export class PromptLoader {
    private promptCache: Map<ProcessingIntent, IntentPrompts> = new Map();

    constructor() {
        // No app dependency needed for embedded prompts
    }

    async loadPromptsForIntent(intent: ProcessingIntent): Promise<IntentPrompts> {
        // Check cache first
        if (this.promptCache.has(intent)) {
            return this.promptCache.get(intent)!;
        }

        try {
            const prompts = this.getEmbeddedPrompts(intent);
            this.promptCache.set(intent, prompts);
            return prompts;
        } catch (error) {
            console.error(`[PromptLoader] Failed to load prompts for intent ${intent}:`, error);
            throw new Error(`Failed to load prompts for intent '${intent}': ${error.message}`);
        }
    }

    private getEmbeddedPrompts(intent: ProcessingIntent): IntentPrompts {
        const promptData = EMBEDDED_PROMPTS[intent];
        if (!promptData) {
            throw new Error(`No prompts found for intent '${intent}'`);
        }

        return {
            structure: this.buildPrompt(promptData.structure),
            content: this.buildPrompt(promptData.content),
            perspectives: this.buildPrompt(promptData.perspectives),
            connections: this.buildPrompt(promptData.connections),
            learning: this.buildPrompt(promptData.learning)
        };
    }

    private buildPrompt(template: PromptTemplate): string {
        let prompt = `${template.role}\n\n`;
        
        if (template.instructions && template.instructions.length > 0) {
            prompt += `INSTRUCTIONS:\n`;
            template.instructions.forEach((instruction, index) => {
                prompt += `${index + 1}. ${instruction}\n`;
            });
            prompt += `\n`;
        }

        prompt += template.template;
        
        if (template.output_schema) {
            prompt += `\n\nReturn ONLY valid JSON:\n${JSON.stringify(template.output_schema, null, 2)}`;
        }

        return prompt;
    }

    clearCache(): void {
        this.promptCache.clear();
    }
}
// Embedded prompt data - this replaces the need for external JSON files
const EMBEDDED_PROMPTS: Record<ProcessingIntent, {
    structure: PromptTemplate;
    content: PromptTemplate;
    perspectives: PromptTemplate;
    connections: PromptTemplate;
    learning: PromptTemplate;
}> = {
    knowledge_building: {
        structure: {
            role: "You are an expert knowledge organizer specializing in educational content analysis.",
            instructions: [
                "Create a learning-focused title that captures educational essence",
                "Place in optimal knowledge hierarchy (use existing domains when possible)",
                "Extract comprehensive metadata for deep learning",
                "Assess learning complexity and prerequisites",
                "Identify source type and learning context"
            ],
            template: "EXISTING KNOWLEDGE: {HIERARCHY_CONTEXT}\n\nTASK: Analyze content and create comprehensive learning-focused metadata.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                title: "Educational title emphasizing learning value",
                hierarchy: {
                    level1: "Primary Knowledge Domain",
                    level2: "Learning Area",
                    level3: "Specific Topic",
                    level4: "Key Concept"
                },
                metadata: {
                    speakers: ["speaker1", "speaker2"],
                    topics: ["core topic 1", "core topic 2"],
                    key_concepts: ["fundamental concept 1", "key principle 2"],
                    tags: ["#learning", "#concept", "#framework"],
                    related: ["connected field 1", "related domain 2"]
                },
                learning_context: {
                    prerequisites: ["required knowledge 1", "background concept 2"],
                    related_concepts: ["connected idea 1", "related theory 2"],
                    learning_path: ["foundation step", "intermediate step", "advanced application"],
                    complexity_level: "beginner|intermediate|advanced",
                    estimated_reading_time: "X minutes"
                },
                source_type: "interview|lecture|article|research|discussion",
                action_items: ["learning action 1", "practice task 2"],
                overview: "2-3 sentences highlighting educational value and key learning outcomes"
            }
        },
        content: {
            role: "You are an expert content analyst specializing in knowledge extraction for deep learning.",
            instructions: [
                "Extract educational insights, core principles, and conceptual frameworks",
                "Focus on comprehensive understanding"
            ],
            template: "CONTEXT: {TITLE} | Domain: {DOMAIN} | Topic: {TOPIC}\n\nFOCUS: Extract educational insights, core principles, and conceptual frameworks for comprehensive understanding.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                context: "Why this knowledge matters and its educational significance",
                key_facts: [
                    "Fact 1: Core information with learning relevance",
                    "Fact 2: Important data with conceptual significance",
                    "Fact 3: Key evidence with practical implications"
                ],
                deep_insights: [
                    "Insight 1: Fundamental understanding and broader implications",
                    "Insight 2: Pattern recognition and knowledge connections",
                    "Insight 3: Underlying principles and mental models"
                ],
                core_concepts: [
                    "Concept 1: #concept Core principle with clear explanation",
                    "Framework 2: #framework Key theory with learning applications",
                    "Model 3: #theory Important mental model with practical use"
                ],
                detailed_summary: "Comprehensive summary emphasizing key learning outcomes and knowledge integration"
            }
        },
        perspectives: {
            role: "You are an expert at multi-perspective analysis and educational example creation.",
            instructions: [
                "Provide diverse viewpoints to deepen understanding",
                "Create concrete learning examples"
            ],
            template: "CONTEXT: {TITLE} | {OVERVIEW}\n\nTASK: Provide diverse viewpoints and concrete learning examples to deepen understanding.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                multiple_perspectives: [
                    {
                        viewpoint: "Theoretical Framework",
                        analysis: "Academic concepts and underlying principles"
                    },
                    {
                        viewpoint: "Practical Application",
                        analysis: "Real-world implementation and use cases"
                    },
                    {
                        viewpoint: "Learning Strategy",
                        analysis: "How to effectively learn and apply this knowledge"
                    }
                ],
                analogies_examples: [
                    {
                        concept: "Core concept being explained",
                        analogy: "Clear analogy that makes concept accessible",
                        real_world_example: "Concrete example demonstrating the concept"
                    }
                ],
                case_studies: [
                    "Case study 1: Specific application showing concept in action",
                    "Case study 2: Different context demonstrating versatility"
                ]
            }
        },
        connections: {
            role: "You are an expert at identifying knowledge connections and practical applications.",
            instructions: [
                "Map connections to other knowledge domains",
                "Identify practical applications"
            ],
            template: "CONTEXT: {TITLE} | {DOMAIN} | Key Concepts: {KEY_CONCEPTS}\n\nTASK: Map connections to other knowledge domains and identify practical applications.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                knowledge_connections: [
                    {
                        related_field: "Connected domain or discipline",
                        connection_type: "conceptual|methodological|practical|theoretical",
                        detailed_explanation: "Specific ways these knowledge areas interconnect"
                    }
                ],
                practical_applications: [
                    {
                        domain: "Application area or field",
                        application: "Specific use case or implementation",
                        implementation: "How to practically apply this knowledge",
                        benefits: "Expected outcomes and value"
                    }
                ],
                implications_consequences: [
                    "Implication 1: Broader impact on understanding or practice",
                    "Consequence 2: What this means for related fields or applications"
                ]
            }
        },
        learning: {
            role: "You are an expert learning designer specializing in knowledge progression and skill development.",
            instructions: [
                "Design learning pathways for knowledge mastery",
                "Create actionable next steps"
            ],
            template: "CONTEXT: {TITLE} | Complexity: {COMPLEXITY} | Prerequisites: {PREREQUISITES}\n\nTASK: Design learning pathways and actionable next steps for knowledge mastery.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                knowledge_gaps: [
                    "Gap 1: Missing foundation with recommended study approach",
                    "Gap 2: Advanced concept requiring deeper exploration"
                ],
                learning_pathways: [
                    {
                        pathway_name: "Progressive Learning Path",
                        steps: [
                            "Foundation: Core concepts and principles",
                            "Development: Intermediate applications and connections",
                            "Mastery: Advanced synthesis and original thinking"
                        ],
                        estimated_time: "2-4 weeks",
                        difficulty: "intermediate"
                    }
                ],
                actionable_next_steps: [
                    {
                        category: "Immediate Actions",
                        actions: [
                            "Action 1: Specific learning task with clear outcome",
                            "Action 2: Practice exercise with measurable result"
                        ]
                    }
                ],
                reflection_questions: [
                    "Question 1: How does this connect to your existing knowledge?",
                    "Question 2: What are the practical implications for your work/interests?"
                ]
            }
        }
    },
    quick_reference: {
        structure: {
            role: "You are an expert at creating actionable reference materials.",
            instructions: [
                "Create a clear, action-oriented title",
                "Extract actionable metadata (tools, steps, requirements)",
                "Assess practical context (difficulty, time needed)",
                "Provide a practical overview"
            ],
            template: "EXISTING KNOWLEDGE: {HIERARCHY_CONTEXT}\n\nTASK: Analyze content and create structure optimized for quick reference and immediate use.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                title: "Clear, actionable title (How to...)",
                hierarchy: {
                    level1: "Reference Domain",
                    level2: "Reference Category",
                    level3: "Reference Type",
                    level4: "Specific Guide"
                },
                metadata: {
                    tools_required: ["tool1", "tool2"],
                    main_steps: ["step1", "step2"],
                    difficulty_level: "easy|medium|hard",
                    time_required: "X minutes/hours",
                    common_issues: ["issue1", "issue2"],
                    tags: ["#howto", "#reference"],
                    related_guides: ["guide1", "guide2"]
                },
                practical_context: {
                    prerequisites: ["requirement1", "requirement2"],
                    use_cases: ["usecase1", "usecase2"],
                    success_criteria: ["criteria1", "criteria2"],
                    estimated_completion_time: "X minutes",
                    skill_level: "beginner|intermediate|advanced"
                },
                source_type: "tutorial|documentation|guide|reference",
                overview: "Brief practical summary of what you'll accomplish"
            }
        },
        content: {
            role: "You are an expert at extracting actionable steps and practical information.",
            instructions: [
                "Extract clear, actionable steps for immediate use",
                "Focus on practical implementation"
            ],
            template: "CONTEXT: {TITLE} | Domain: {DOMAIN} | Difficulty: {DIFFICULTY}\n\nTASK: Extract clear, actionable steps and practical information for immediate use.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                step_by_step_guide: [
                    "Step 1: Clear action with specific details",
                    "Step 2: Next action with expected outcome",
                    "Step 3: Following step with verification method"
                ],
                key_requirements: [
                    "Requirement 1: What you need before starting",
                    "Requirement 2: Tools or resources needed",
                    "Requirement 3: Skills or knowledge required"
                ],
                important_details: [
                    "Critical detail 1: Important consideration or warning",
                    "Critical detail 2: Key point that affects success",
                    "Critical detail 3: Essential information for completion"
                ],
                expected_outcomes: [
                    "Outcome 1: What you should see after step X",
                    "Outcome 2: How to verify success",
                    "Outcome 3: Final result or achievement"
                ],
                practical_summary: "Concise summary focusing on what you'll do and achieve"
            }
        },
        perspectives: {
            role: "You are an expert at providing practical examples and alternative approaches.",
            instructions: [
                "Focus on practical examples and alternative methods",
                "Provide real-world applications"
            ],
            template: "CONTEXT: {TITLE} | {OVERVIEW}\n\nTASK: Focus on practical examples, alternative methods, and real-world applications.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                alternative_approaches: [
                    {
                        method: "Alternative Method 1",
                        description: "How this approach works differently",
                        pros_cons: "When to use this method and trade-offs"
                    },
                    {
                        method: "Alternative Method 2",
                        description: "Another way to accomplish the same goal",
                        pros_cons: "Benefits and limitations of this approach"
                    }
                ],
                practical_examples: [
                    {
                        scenario: "Common use case scenario",
                        example: "Specific example showing the process",
                        result: "What the outcome looks like in practice"
                    }
                ],
                real_world_applications: [
                    "Application 1: Where this is commonly used",
                    "Application 2: Another practical context for this process"
                ]
            }
        },
        connections: {
            role: "You are an expert at identifying related procedures and practical connections.",
            instructions: [
                "Focus on related procedures and workflow connections",
                "Identify practical applications"
            ],
            template: "CONTEXT: {TITLE} | {DOMAIN} | Steps: {MAIN_STEPS}\n\nTASK: Focus on related procedures, workflow connections, and practical applications.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                related_procedures: [
                    {
                        procedure: "Related process or workflow",
                        connection: "How it connects to this guide",
                        when_to_use: "When you'd use this related procedure"
                    }
                ],
                workflow_integration: [
                    {
                        workflow: "Larger workflow or process",
                        integration_point: "Where this guide fits in",
                        sequence: "What comes before and after this process"
                    }
                ],
                practical_implications: [
                    "Implication 1: What this enables you to do next",
                    "Implication 2: How this affects your workflow"
                ]
            }
        },
        learning: {
            role: "You are an expert at identifying troubleshooting steps and improvement opportunities.",
            instructions: [
                "Focus on troubleshooting and optimization",
                "Provide next-level improvements"
            ],
            template: "CONTEXT: {TITLE} | Difficulty: {DIFFICULTY} | Steps: {STEPS}\n\nTASK: Focus on troubleshooting, optimization, and next-level improvements.\n\n{ADDITIONAL_INSTRUCTIONS}\n\nContent: {CONTENT}",
            output_schema: {
                troubleshooting_guide: [
                    "Common issue 1: Problem description and solution",
                    "Common issue 2: Another frequent problem and fix",
                    "Common issue 3: Edge case and resolution"
                ],
                optimization_tips: [
                    {
                        area: "Performance Optimization",
                        tips: [
                            "Tip 1: How to make this faster or more efficient",
                            "Tip 2: Another way to improve the process"
                        ]
                    }
                ],
                next_level_actions: [
                    {
                        category: "Advanced Techniques",
                        actions: [
                            "Advanced action 1: More sophisticated approach",
                            "Advanced action 2: Expert-level enhancement"
                        ]
                    }
                ],
                verification_checklist: [
                    "Check 1: How to verify step X worked correctly",
                    "Check 2: What to confirm before proceeding",
                    "Check 3: Final validation of complete process"
                ]
            }
        }
    },
    // For brevity, I'll add simplified versions of the other intents
    research_collection: {
        structure: {
            role: "You are an expert research organizer specializing in academic content analysis.",
            instructions: ["Create research-focused metadata", "Assess academic significance"],
            template: "TASK: Analyze content for research purposes.\n\nContent: {CONTENT}",
            output_schema: { title: "Research title", overview: "Research summary" }
        },
        content: {
            role: "You are an expert research analyst.",
            instructions: ["Extract research findings", "Focus on methodology"],
            template: "TASK: Extract research insights.\n\nContent: {CONTENT}",
            output_schema: { findings: ["Finding 1"], methodology: ["Method 1"] }
        },
        perspectives: {
            role: "You are an expert at research perspective analysis.",
            instructions: ["Provide academic viewpoints"],
            template: "TASK: Provide research perspectives.\n\nContent: {CONTENT}",
            output_schema: { perspectives: [{ viewpoint: "Academic", analysis: "Analysis" }] }
        },
        connections: {
            role: "You are an expert at research connections.",
            instructions: ["Map research connections"],
            template: "TASK: Identify research connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ field: "Field", connection: "Connection" }] }
        },
        learning: {
            role: "You are an expert research mentor.",
            instructions: ["Design research pathways"],
            template: "TASK: Create research learning path.\n\nContent: {CONTENT}",
            output_schema: { pathways: [{ name: "Path", steps: ["Step 1"] }] }
        }
    },
    event_documentation: {
        structure: {
            role: "You are an expert event organizer.",
            instructions: ["Create event-focused metadata"],
            template: "TASK: Analyze event content.\n\nContent: {CONTENT}",
            output_schema: { title: "Event title", overview: "Event summary" }
        },
        content: {
            role: "You are an expert meeting analyst.",
            instructions: ["Extract decisions and action items"],
            template: "TASK: Extract event outcomes.\n\nContent: {CONTENT}",
            output_schema: { decisions: ["Decision 1"], actions: ["Action 1"] }
        },
        perspectives: {
            role: "You are an expert at stakeholder analysis.",
            instructions: ["Provide stakeholder viewpoints"],
            template: "TASK: Analyze stakeholder perspectives.\n\nContent: {CONTENT}",
            output_schema: { perspectives: [{ stakeholder: "Role", viewpoint: "View" }] }
        },
        connections: {
            role: "You are an expert at event connections.",
            instructions: ["Map event relationships"],
            template: "TASK: Identify event connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ event: "Event", relation: "Relation" }] }
        },
        learning: {
            role: "You are an expert event facilitator.",
            instructions: ["Identify lessons learned"],
            template: "TASK: Extract event lessons.\n\nContent: {CONTENT}",
            output_schema: { lessons: ["Lesson 1"], improvements: ["Improvement 1"] }
        }
    },
    professional_intelligence: {
        structure: {
            role: "You are an expert business analyst.",
            instructions: ["Create business-focused metadata"],
            template: "TASK: Analyze business content.\n\nContent: {CONTENT}",
            output_schema: { title: "Business title", overview: "Business summary" }
        },
        content: {
            role: "You are an expert business content analyst.",
            instructions: ["Extract business insights"],
            template: "TASK: Extract business intelligence.\n\nContent: {CONTENT}",
            output_schema: { insights: ["Insight 1"], implications: ["Implication 1"] }
        },
        perspectives: {
            role: "You are an expert at business perspective analysis.",
            instructions: ["Provide business viewpoints"],
            template: "TASK: Analyze business perspectives.\n\nContent: {CONTENT}",
            output_schema: { perspectives: [{ stakeholder: "Role", viewpoint: "View" }] }
        },
        connections: {
            role: "You are an expert at business connections.",
            instructions: ["Map business relationships"],
            template: "TASK: Identify business connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ area: "Area", connection: "Connection" }] }
        },
        learning: {
            role: "You are an expert business strategist.",
            instructions: ["Identify strategic opportunities"],
            template: "TASK: Create business recommendations.\n\nContent: {CONTENT}",
            output_schema: { recommendations: ["Recommendation 1"], metrics: ["Metric 1"] }
        }
    },
    personal_development: {
        structure: {
            role: "You are an expert personal development coach.",
            instructions: ["Create growth-focused metadata"],
            template: "TASK: Analyze development content.\n\nContent: {CONTENT}",
            output_schema: { title: "Development title", overview: "Growth summary" }
        },
        content: {
            role: "You are an expert development analyst.",
            instructions: ["Extract growth insights"],
            template: "TASK: Extract development insights.\n\nContent: {CONTENT}",
            output_schema: { insights: ["Insight 1"], strategies: ["Strategy 1"] }
        },
        perspectives: {
            role: "You are an expert at development perspective analysis.",
            instructions: ["Provide growth viewpoints"],
            template: "TASK: Analyze growth perspectives.\n\nContent: {CONTENT}",
            output_schema: { perspectives: [{ perspective: "Growth", analysis: "Analysis" }] }
        },
        connections: {
            role: "You are an expert at development connections.",
            instructions: ["Map development relationships"],
            template: "TASK: Identify development connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ area: "Area", synergy: "Synergy" }] }
        },
        learning: {
            role: "You are an expert development mentor.",
            instructions: ["Design growth pathways"],
            template: "TASK: Create development plan.\n\nContent: {CONTENT}",
            output_schema: { plan: [{ phase: "Phase", actions: ["Action 1"] }] }
        }
    },
    news_events: {
        structure: {
            role: "You are an expert news analyst.",
            instructions: ["Create news-focused metadata"],
            template: "TASK: Analyze news content.\n\nContent: {CONTENT}",
            output_schema: { title: "News title", overview: "News summary" }
        },
        content: {
            role: "You are an expert news content analyst.",
            instructions: ["Extract key facts"],
            template: "TASK: Extract news facts.\n\nContent: {CONTENT}",
            output_schema: { facts: ["Fact 1"], timeline: ["Event 1"] }
        },
        perspectives: {
            role: "You are an expert at news perspective analysis.",
            instructions: ["Provide balanced viewpoints"],
            template: "TASK: Analyze news perspectives.\n\nContent: {CONTENT}",
            output_schema: { viewpoints: [{ perspective: "Official", viewpoint: "View" }] }
        },
        connections: {
            role: "You are an expert at news connections.",
            instructions: ["Map news relationships"],
            template: "TASK: Identify news connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ event: "Event", relation: "Relation" }] }
        },
        learning: {
            role: "You are an expert news analyst.",
            instructions: ["Identify trends"],
            template: "TASK: Extract news trends.\n\nContent: {CONTENT}",
            output_schema: { trends: ["Trend 1"], lessons: ["Lesson 1"] }
        }
    },
    inspiration_capture: {
        structure: {
            role: "You are an expert creativity curator.",
            instructions: ["Create inspiration-focused metadata"],
            template: "TASK: Analyze inspirational content.\n\nContent: {CONTENT}",
            output_schema: { title: "Inspiring title", overview: "Inspiration summary" }
        },
        content: {
            role: "You are an expert inspiration analyst.",
            instructions: ["Extract inspiring insights"],
            template: "TASK: Extract inspiration.\n\nContent: {CONTENT}",
            output_schema: { insights: ["Insight 1"], sparks: ["Spark 1"] }
        },
        perspectives: {
            role: "You are an expert at inspiration perspective analysis.",
            instructions: ["Provide creative viewpoints"],
            template: "TASK: Analyze creative perspectives.\n\nContent: {CONTENT}",
            output_schema: { perspectives: [{ perspective: "Artistic", viewpoint: "View" }] }
        },
        connections: {
            role: "You are an expert at inspiration connections.",
            instructions: ["Map creative relationships"],
            template: "TASK: Identify inspiration connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ inspiration: "Source", synergy: "Synergy" }] }
        },
        learning: {
            role: "You are an expert creativity coach.",
            instructions: ["Design inspiration pathways"],
            template: "TASK: Create inspiration plan.\n\nContent: {CONTENT}",
            output_schema: { cultivation: [{ practice: "Practice", benefit: "Benefit" }] }
        }
    },
    how_to: {
        structure: {
            role: "You are an expert tutorial creator.",
            instructions: ["Create tutorial-focused metadata"],
            template: "TASK: Analyze tutorial content.\n\nContent: {CONTENT}",
            output_schema: { title: "How-to title", overview: "Tutorial summary" }
        },
        content: {
            role: "You are an expert tutorial analyst.",
            instructions: ["Extract actionable steps"],
            template: "TASK: Extract tutorial steps.\n\nContent: {CONTENT}",
            output_schema: { steps: ["Step 1"], techniques: ["Technique 1"] }
        },
        perspectives: {
            role: "You are an expert at tutorial perspective analysis.",
            instructions: ["Provide alternative approaches"],
            template: "TASK: Analyze tutorial approaches.\n\nContent: {CONTENT}",
            output_schema: { methods: [{ method: "Method", description: "Description" }] }
        },
        connections: {
            role: "You are an expert at tutorial connections.",
            instructions: ["Map tutorial relationships"],
            template: "TASK: Identify tutorial connections.\n\nContent: {CONTENT}",
            output_schema: { connections: [{ tutorial: "Tutorial", relation: "Relation" }] }
        },
        learning: {
            role: "You are an expert tutorial mentor.",
            instructions: ["Design mastery pathways"],
            template: "TASK: Create mastery plan.\n\nContent: {CONTENT}",
            output_schema: { progression: [{ level: "Level", focus: "Focus" }] }
        }
    }
};