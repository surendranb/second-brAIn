/**
 * Hierarchy Choice Modal Component
 */

import { App, Modal } from 'obsidian';
import { MOCHierarchy, LearningContext, HierarchyAnalysisResult } from '../../types';

export interface HierarchyChoiceResult {
    hierarchy: MOCHierarchy;
    learning_context?: LearningContext;
}

export class HierarchyChoiceModal extends Modal {
    private result: HierarchyChoiceResult | null = null;
    private onChoose: (result: HierarchyChoiceResult) => void;
    private analysisResult: HierarchyAnalysisResult;
    private confirmButton: HTMLButtonElement;

    constructor(app: App, analysisResult: HierarchyAnalysisResult, onChoose: (result: HierarchyChoiceResult) => void) {
        super(app);
        this.analysisResult = analysisResult;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: '🎯 Choose hierarchy placement' });

        // Cross-domain explanation
        const explanation = contentEl.createEl('div', { cls: 'axiom-hierarchy-explanation' });
        explanation.createEl('p', { text: 'Cross-domain content detected!' }).createEl('strong');
        explanation.createEl('p', { text: 'This content could legitimately belong in multiple knowledge domains.' });
        explanation.createEl('p', { text: 'Choose the best placement for your learning goals.' });

        // Confidence score
        if (this.analysisResult.confidence_score) {
            contentEl.createEl('div', {
                text: `AI confidence: ${Math.round(this.analysisResult.confidence_score * 100)}%`,
                cls: 'axiom-confidence-score'
            });
        }

        // Primary hierarchy
        this.createHierarchyOption(contentEl, this.analysisResult.primary_hierarchy, true, '🎯 Primary recommendation', this.analysisResult.reasoning);

        // Alternative hierarchies
        if (this.analysisResult.alternative_hierarchies && this.analysisResult.alternative_hierarchies.length > 0) {
            contentEl.createEl('h3', { text: '🔄 Alternative placements' });
            this.analysisResult.alternative_hierarchies.forEach((alt, index) => {
                this.createHierarchyOption(contentEl, alt.hierarchy, false, `Alternative ${index + 1} (${Math.round(alt.strength * 100)}% strength)`, alt.reasoning);
            });
        }

        // Buttons
        const buttonContainer = contentEl.createEl('div', { cls: 'axiom-modal-button-container' });

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        this.confirmButton = buttonContainer.createEl('button', { text: 'Confirm selection', cls: 'axiom-confirm-button' });
        this.confirmButton.disabled = true;
        this.confirmButton.addEventListener('click', () => this.handleConfirm());
    }

    private createHierarchyOption(containerEl: HTMLElement, hierarchy: MOCHierarchy, isPrimary: boolean, title: string, reasoning?: string) {
        const optionContainer = containerEl.createEl('div', { 
            cls: `axiom-hierarchy-option ${isPrimary ? 'axiom-hierarchy-option-primary' : 'axiom-hierarchy-option-alt'}` 
        });

        optionContainer.createEl('h4', { 
            text: title,
            cls: `axiom-hierarchy-option-title ${isPrimary ? 'axiom-hierarchy-option-title-primary' : ''}`
        });

        // Hierarchy path
        const pathParts = [hierarchy.level1, hierarchy.level2, hierarchy.level3, hierarchy.level4].filter(p => !!p);
        optionContainer.createEl('div', { 
            text: pathParts.join(' > '),
            cls: 'axiom-hierarchy-path'
        });

        // Reasoning
        if (reasoning) {
            optionContainer.createEl('div', { 
                text: reasoning,
                cls: 'axiom-hierarchy-reasoning'
            });
        }

        // Radio button for single selection
        const radio = optionContainer.createEl('input', { type: 'radio', cls: 'axiom-hierarchy-radio' });
        radio.name = 'hierarchy-choice';

        if (isPrimary) {
            radio.checked = true;
            this.result = {
                hierarchy: hierarchy,
                learning_context: this.analysisResult.learning_context
            };
            this.updateButtons();
        }

        radio.addEventListener('change', () => {
            if (radio.checked) {
                this.result = {
                    hierarchy: hierarchy,
                    learning_context: this.analysisResult.learning_context
                };
                this.updateButtons();
            }
        });

        optionContainer.addEventListener('click', (e) => {
            if (e.target !== radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        });
    }

    private updateButtons() {
        if (this.confirmButton) {
            this.confirmButton.disabled = !this.result;
        }
    }

    private handleConfirm() {
        if (this.result) {
            this.onChoose(this.result);
            this.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}