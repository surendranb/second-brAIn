/**
 * HierarchyService - AI-Driven MOC Creation
 * 
 * Replaces rule-based hierarchy analysis with pure AI-driven approach.
 * Uses clear prompts with examples to determine optimal knowledge organization.
 */

export interface HierarchyAnalysisResult {
    hierarchy: {
        level1: string; // Domain (e.g., "Computer Science")
        level2: string; // Area (e.g., "Artificial Intelligence") 
        level3?: string; // Topic (e.g., "Machine Learning")
        level4?: string; // Concept (e.g., "Neural Networks")
    };
    confidence: number; // 0-1 confidence score
    reasoning: string; // AI's explanation for the choice
    alternatives?: {
        level1: string;
        reasoning: string;
    }[]; // Alternative Level 1 domains if content spans multiple areas
}

export class HierarchyService {
    private llmService: any;
    private traceManager: any;

    constructor(llmService: any, traceManager: any) {
        this.llmService = llmService;
        this.traceManager = traceManager;
    }

    /**
     * Analyze content and determine optimal hierarchy placement using AI
     */
    async analyzeHierarchy(
        title: string, 
        content: string, 
        metadata: any = {},
        traceId?: string
    ): Promise<HierarchyAnalysisResult> {
        
        console.log('🧠 [TRACE] HierarchyService.analyzeHierarchy() called for:', title);
        const prompt = this.buildHierarchyPrompt(title, content, metadata);
        
        console.log('🤖 [TRACE] Sending hierarchy analysis prompt to AI');
        
        try {
            const response = await this.traceManager.generateText(
                {
                    prompt,
                    model: 'gemini-2.5-flash', // Use fast model for hierarchy analysis
                    metadata: { 
                        type: 'hierarchy-analysis',
                        title: title.substring(0, 100)
                    }
                },
                {
                    traceId,
                    generationName: 'hierarchy-analysis',
                    pass: 'Hierarchy Analysis',
                    intent: 'hierarchy-classification'
                }
            );

            // Parse AI response
            const result = this.parseHierarchyResponse(response.text);
            
            console.log('[HierarchyService] ✅ Hierarchy analysis complete:', {
                level1: result.hierarchy.level1,
                level2: result.hierarchy.level2,
                confidence: result.confidence
            });
            
            return result;
            
        } catch (error) {
            console.error('[HierarchyService] ❌ Hierarchy analysis failed:', error);
            
            // Fallback to simple classification
            return this.getFallbackHierarchy(title, content, metadata);
        }
    }

    /**
     * Build comprehensive hierarchy analysis prompt with examples
     */
    private buildHierarchyPrompt(title: string, content: string, metadata: any): string {
        return `You are an expert knowledge architect specializing in organizing information into clear, logical hierarchies. Your task is to analyze content and determine the optimal 4-level knowledge hierarchy placement.

HIERARCHY STRUCTURE:
- Level 1 (Domain): Broad field of knowledge (e.g., "Computer Science", "Economics", "Psychology")
- Level 2 (Area): Major subdivision within the domain (e.g., "Artificial Intelligence", "Behavioral Economics")  
- Level 3 (Topic): Specific subject within the area (e.g., "Machine Learning", "Consumer Behavior")
- Level 4 (Concept): Particular concept or technique (e.g., "Neural Networks", "Loss Aversion")

CRITICAL RULES:
1. **Single Domain Focus**: Choose ONE Level 1 domain based on PRIMARY expertise/focus
2. **No Combinations**: Use "Economics" OR "Business", never "Business & Economics"
3. **Standard Domains**: Prefer established academic/professional fields
4. **Learning-First**: Optimize for knowledge retrieval and learning connections

STANDARD LEVEL 1 DOMAINS (prefer these):
- Computer Science
- Economics  
- Business
- Psychology
- Physics
- Chemistry
- Biology
- Medicine
- Mathematics
- Engineering
- Philosophy
- History
- Politics
- Sociology
- Anthropology
- Linguistics
- Education
- Law
- Art
- Literature

ANALYSIS EXAMPLES:

**Example 1: Nobel Prize Winner in Economics Discusses Poverty Alleviation Through Technology**
- Primary Focus: Economic theory and policy (Nobel Prize expertise)
- Technology: Tool/method, not the core expertise
- Classification: Economics → Development Economics → Poverty Alleviation → Technology Solutions
- Reasoning: "The authority and primary expertise comes from economics. Technology is the method, not the focus."

**Example 2: AI Research Paper on Neural Network Architecture**
- Primary Focus: Computer science research and methodology
- Classification: Computer Science → Artificial Intelligence → Machine Learning → Neural Network Architectures
- Reasoning: "Core contribution is to computer science methodology and AI research."

**Example 3: Business Strategy Article Using AI for Customer Analytics**
- Primary Focus: Business strategy and decision-making
- AI: Tool for business application
- Classification: Business → Strategy → Customer Analytics → AI-Powered Insights
- Reasoning: "Primary value is business strategy. AI is the implementation tool."

**Example 4: Psychological Study on Decision-Making Biases in Financial Markets**
- Primary Focus: Psychological research and human behavior
- Finance: Application domain
- Classification: Psychology → Cognitive Psychology → Decision Making → Financial Decision Biases
- Reasoning: "Core research is psychological. Financial markets are the application context."

**Example 5: Physics Paper on Quantum Computing Applications**
- Primary Focus: Physics principles and quantum mechanics
- Computing: Application area
- Classification: Physics → Quantum Physics → Quantum Computing → Quantum Algorithms
- Reasoning: "Fundamental contribution is to physics understanding of quantum systems."

CONFLICT RESOLUTION STRATEGY:
When content spans multiple domains, ask:
1. "What field provides the PRIMARY expertise/authority?"
2. "What's the core problem being solved?"
3. "Where would someone naturally look for similar content?"
4. "What discipline owns the fundamental concepts?"

CONTENT TO ANALYZE:

**Title:** ${title}

**Content Preview:** ${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

**Metadata:** ${JSON.stringify(metadata, null, 2)}

ANALYSIS TASK:
1. Identify the PRIMARY domain based on expertise/authority
2. Build the complete 4-level hierarchy
3. Provide confidence score (0-1)
4. Explain your reasoning
5. Note any alternative Level 1 domains if content could reasonably fit elsewhere

Return ONLY valid JSON in this exact format:
{
  "hierarchy": {
    "level1": "Primary Domain Name",
    "level2": "Area within Domain", 
    "level3": "Specific Topic",
    "level4": "Particular Concept"
  },
  "confidence": 0.85,
  "reasoning": "Detailed explanation of why this classification was chosen, focusing on primary expertise and learning optimization.",
  "alternatives": [
    {
      "level1": "Alternative Domain",
      "reasoning": "Why this could also be a valid classification"
    }
  ]
}`;
    }

    /**
     * Parse AI response and validate hierarchy structure
     */
    private parseHierarchyResponse(responseText: string): HierarchyAnalysisResult {
        try {
            // Clean response text
            let cleanedText = responseText.trim();
            
            // Remove markdown code blocks if present
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            const parsed = JSON.parse(cleanedText);
            
            // Validate required fields
            if (!parsed.hierarchy || !parsed.hierarchy.level1 || !parsed.hierarchy.level2) {
                throw new Error('Missing required hierarchy levels');
            }
            
            // Ensure confidence is between 0 and 1
            const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
            
            return {
                hierarchy: {
                    level1: parsed.hierarchy.level1.trim(),
                    level2: parsed.hierarchy.level2.trim(),
                    level3: parsed.hierarchy.level3?.trim(),
                    level4: parsed.hierarchy.level4?.trim()
                },
                confidence,
                reasoning: parsed.reasoning || 'No reasoning provided',
                alternatives: parsed.alternatives || []
            };
            
        } catch (error) {
            console.error('[HierarchyService] Failed to parse AI response:', error);
            console.log('[HierarchyService] Raw response:', responseText);
            
            // Try to extract basic info from failed parse
            return this.extractBasicHierarchy(responseText);
        }
    }

    /**
     * Extract basic hierarchy info from malformed AI response
     */
    private extractBasicHierarchy(responseText: string): HierarchyAnalysisResult {
        // Try to extract level1 and level2 from text
        const level1Match = responseText.match(/level1["\s]*:[\s"]*([^"}\n,]+)/i);
        const level2Match = responseText.match(/level2["\s]*:[\s"]*([^"}\n,]+)/i);
        
        const level1 = level1Match ? level1Match[1].trim() : 'General Knowledge';
        const level2 = level2Match ? level2Match[1].trim() : 'Miscellaneous';
        
        return {
            hierarchy: {
                level1,
                level2
            },
            confidence: 0.3, // Low confidence for fallback
            reasoning: 'Fallback classification due to parsing error'
        };
    }

    /**
     * Fallback hierarchy when AI analysis fails
     */
    private getFallbackHierarchy(title: string, content: string, metadata: any): HierarchyAnalysisResult {
        // Simple keyword-based fallback
        const text = `${title} ${content}`.toLowerCase();
        
        let level1 = 'General Knowledge';
        let level2 = 'Miscellaneous';
        
        // Basic domain detection
        if (text.includes('computer') || text.includes('software') || text.includes('programming') || text.includes('ai')) {
            level1 = 'Computer Science';
            level2 = 'Programming';
        } else if (text.includes('business') || text.includes('management') || text.includes('marketing')) {
            level1 = 'Business';
            level2 = 'Strategy';
        } else if (text.includes('economic') || text.includes('finance') || text.includes('market')) {
            level1 = 'Economics';
            level2 = 'Markets';
        } else if (text.includes('psychology') || text.includes('behavior') || text.includes('cognitive')) {
            level1 = 'Psychology';
            level2 = 'Cognitive Psychology';
        }
        
        return {
            hierarchy: { level1, level2 },
            confidence: 0.4, // Low confidence for fallback
            reasoning: 'Fallback classification using keyword detection'
        };
    }
}