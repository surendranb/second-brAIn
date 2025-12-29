/**
 * HierarchyService - AI-Driven MOC Creation
 */

export interface HierarchyAnalysisResult {
    hierarchy: {
        level1: string; 
        level2: string; 
        level3?: string; 
        level4?: string;
    };
    confidence: number;
    reasoning: string;
    alternatives?: {
        level1: string;
        reasoning: string;
    }[];
}

export class HierarchyService {
    private llmService: any;
    private traceManager: any;

    constructor(llmService: any, traceManager: any) {
        this.llmService = llmService;
        this.traceManager = traceManager;
    }

    async analyzeHierarchy(
        title: string, 
        content: string, 
        metadata: any = {},
        traceId?: string,
        model?: string,
        vaultMap?: string
    ): Promise<HierarchyAnalysisResult> {
        let prompt = this.buildHierarchyPrompt(title, content, metadata);
        if (vaultMap) {
            prompt = `EXISTING_VAULT_MAP:\n${vaultMap}\n\n${prompt}`;
        }
        
        try {
            const response = await this.traceManager.generateText(
                {
                    prompt,
                    model: model || 'gemini-2.5-flash',
                    metadata: { type: 'hierarchy-analysis', title: title.substring(0, 100) }
                },
                {
                    traceId,
                    generationName: 'hierarchy-analysis',
                    pass: 'Hierarchy Analysis',
                    intent: 'hierarchy-classification'
                }
            );

            return this.parseHierarchyResponse(response.text);
            
        } catch (error) {
            console.error('Hierarchy analysis failed:', error);
            return this.getFallbackHierarchy(title, content, metadata);
        }
    }

    private buildHierarchyPrompt(title: string, content: string, metadata: any): string {
        return `You are an expert knowledge architect building a permanent library. Your goal is to place this content in its "Truest Semantic Home".

GUIDING PRINCIPLES:
1. **SEEK SEMANTIC PRECISION:** Place content where a university librarian would file it. (e.g., "Jet Engines" belongs in "Engineering", not "Business", even if the article mentions costs).
2. **CONSULT & VERIFY:** Look at the EXISTING_VAULT_MAP.
   - **Reuse** existing paths ONLY if the ENTIRE hierarchy makes sense.
   - **SANITY CHECK:** If you find "Theoretical Physics" nested under "Computer Science" in the map, **CORRECT IT**. Do not propagate structural errors.
   - **Refactor on the Fly:** If the map has "Jet Engines" under "AI", ignore it and create the correct "Engineering" path.
3. **DISTINGUISH FORM FROM FUNCTION:**
   - The *Folder Structure* must reflect the **Subject Matter** (The "What").
   - The *Metadata/Tags* will capture the **Context** (The "Why").

STRUCTURE:
- Level 1 (Domain): Broad academic/industry field (e.g., "Physics", "Health").
- Level 2 (Area): Major discipline (e.g., "Thermodynamics", "Metabolic Health").
- Level 3 (Topic): Specific subject.
- Level 4 (Concept): Atomic idea.

CONTENT:
Title: ${title}
Preview: ${content.substring(0, 2000)}
Metadata: ${JSON.stringify(metadata, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "hierarchy": {
    "level1": "Domain",
    "level2": "Area", 
    "level3": "Topic",
    "level4": "Concept"
  },
  "confidence": 0.85,
  "reasoning": "Explain your architectural decision. Why is this the truest home for this concept?",
  "alternatives": []
}`;
    }

    private parseHierarchyResponse(responseText: string): HierarchyAnalysisResult {
        try {
            let cleanedText = responseText.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            const parsed = JSON.parse(cleanedText);
            if (!parsed.hierarchy || !parsed.hierarchy.level1 || !parsed.hierarchy.level2) {
                throw new Error('Invalid hierarchy');
            }
            
            return {
                hierarchy: {
                    level1: parsed.hierarchy.level1.trim(),
                    level2: parsed.hierarchy.level2.trim(),
                    level3: parsed.hierarchy.level3?.trim(),
                    level4: parsed.hierarchy.level4?.trim()
                },
                confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                reasoning: parsed.reasoning || 'No reasoning',
                alternatives: parsed.alternatives || []
            };
        } catch (error) {
            return this.extractBasicHierarchy(responseText);
        }
    }

    private extractBasicHierarchy(responseText: string): HierarchyAnalysisResult {
        const level1Match = responseText.match(/level1["\s]*:[\s"]*([^"}\n,]+)/i);
        const level2Match = responseText.match(/level2["\s]*:[\s"]*([^"}\n,]+)/i);
        return {
            hierarchy: {
                level1: level1Match ? level1Match[1].trim() : 'General Knowledge',
                level2: level2Match ? level2Match[1].trim() : 'Miscellaneous'
            },
            confidence: 0.3,
            reasoning: 'Fallback due to parse error'
        };
    }

    private getFallbackHierarchy(title: string, content: string, metadata: any): HierarchyAnalysisResult {
        const text = `${title} ${content}`.toLowerCase();
        let level1 = 'General Knowledge', level2 = 'Miscellaneous';
        
        if (text.includes('computer') || text.includes('ai')) {
            level1 = 'Computer Science'; level2 = 'AI';
        } else if (text.includes('business')) {
            level1 = 'Business'; level2 = 'Strategy';
        }
        
        return { hierarchy: { level1, level2 }, confidence: 0.4, reasoning: 'Keyword fallback' };
    }
}