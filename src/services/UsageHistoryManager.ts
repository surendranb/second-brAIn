import { App } from 'obsidian';

export interface UsageRecord {
    noteId: string;
    timestamp: string; // ISO string
    inputTokens: number;
    outputTokens: number;
    cost: number;
    model?: string;
    intent?: string;
}

export interface UsageMetrics {
    notes: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
}

export interface AggregatedMetrics {
    lifetime: UsageMetrics;
    today: UsageMetrics;
}

export class UsageHistoryManager {
    private app: App;
    private historyFile: string;
    private cache: UsageRecord[] | null = null;

    constructor(app: App) {
        this.app = app;
        this.historyFile = '.obsidian/plugins/second-brAIn/usage-history.json';
    }

    /**
     * Add a new usage record
     */
    async addRecord(record: Omit<UsageRecord, 'timestamp'>): Promise<void> {
        const fullRecord: UsageRecord = {
            ...record,
            timestamp: new Date().toISOString()
        };

        try {
            // Load existing records
            const records = await this.loadRecords();
            
            // Add new record
            records.push(fullRecord);
            
            // Save back to file
            await this.saveRecords(records);
            
            // Update cache
            this.cache = records;
        } catch (error) {
            console.error('[UsageHistoryManager] Failed to add record:', error);
        }
    }

    /**
     * Get aggregated metrics
     */
    async getMetrics(): Promise<AggregatedMetrics> {
        const records = await this.loadRecords();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Calculate lifetime (all records)
        const lifetime = this.calculateMetrics(records);

        // Calculate today (records from today only)
        const todayRecords = records.filter(record => 
            record.timestamp.startsWith(today)
        );
        const todayMetrics = this.calculateMetrics(todayRecords);

        return {
            lifetime,
            today: todayMetrics
        };
    }

    /**
     * Load records from file
     */
    private async loadRecords(): Promise<UsageRecord[]> {
        if (this.cache) {
            return this.cache;
        }

        try {
            const fileExists = await this.app.vault.adapter.exists(this.historyFile);
            if (!fileExists) {
                return [];
            }

            const content = await this.app.vault.adapter.read(this.historyFile);
            const records = JSON.parse(content) as UsageRecord[];
            this.cache = records;
            return records;
        } catch (error) {
            console.error('[UsageHistoryManager] Failed to load records:', error);
            return [];
        }
    }

    /**
     * Save records to file
     */
    private async saveRecords(records: UsageRecord[]): Promise<void> {
        try {
            const content = JSON.stringify(records, null, 2);
            await this.app.vault.adapter.write(this.historyFile, content);
        } catch (error) {
            console.error('[UsageHistoryManager] Failed to save records:', error);
        }
    }

    /**
     * Calculate metrics from records
     */
    private calculateMetrics(records: UsageRecord[]): UsageMetrics {
        return records.reduce((acc, record) => ({
            notes: acc.notes + 1,
            inputTokens: acc.inputTokens + record.inputTokens,
            outputTokens: acc.outputTokens + record.outputTokens,
            totalTokens: acc.totalTokens + record.inputTokens + record.outputTokens,
            cost: acc.cost + record.cost
        }), {
            notes: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost: 0
        });
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache(): void {
        this.cache = null;
    }
}