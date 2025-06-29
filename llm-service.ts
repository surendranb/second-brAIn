interface LLMResponse {
    success: boolean;
    content?: string;
    error?: string;
}

export class LLMService {
    private baseUrl = 'http://localhost:3333';
    private initialized = false;

    async initialize(apiKey: string, model: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ apiKey, model }),
            });
            const data = await response.json();
            this.initialized = data.success;
            return data.success;
        } catch (error) {
            console.error('Error initializing LLM service:', error);
            return false;
        }
    }

    async generateContent(prompt: string, model: string): Promise<LLMResponse> {
        if (!this.initialized) {
            return { success: false, error: 'LLM service not initialized' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, model }),
            });
            return await response.json();
        } catch (error) {
            console.error('Error generating content:', error);
            return { success: false, error: String(error) };
        }
    }
}
