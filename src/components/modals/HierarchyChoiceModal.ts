/**
 * Hierarchy Choice Modal Component
 * Extracted from main.ts for better modularity
 */

import { App, Modal } from 'obsidian';
import { MOCHierarchy, LearningContext } from '../../types';

export class HierarchyChoiceModal extends Modal {
    private result: { hierarchy: MOCHierarchy, learning_context: LearningContext } | null = null;
    private onChoose: (result: { hierarchy: MOCHierarchy, learning_context: LearningContext }) => void;
    private analysisResult: any;
    private allowMultiple: boolean = false;
    private selectedHierarchies: MOCHierarchy[] = [];
    private confirmButton: HTMLButtonElement;

    constructor(app: App, analysisResult: any, onChoose: (result: { hierarchy: MOCHierarchy, learning_context: LearningContext }) => void) {
        super(app);
        this.analysisResult = analysisResult;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: '🎯 Choose Hierarchy Placement' });

        // Cross-domain explanation
        const explanation = contentEl.createEl('div', { cls: 'hierarchy-choice-explanation' });
        explanation.innerHTML = `
            <p><strong>Cross-domain content detected!</strong> This content could legitimately belong in multiple knowledge domains.</p>
            <p>Choose the best placement for your learning goals, or select multiple hierarchies if the content truly spans domains.</p>
        `;
        explanation.style.marginBottom = '20px';
        explanation.style.padding = '12px';
        explanation.style.backgroundColor = 'var(--background-secondary)';
        explanation.style.borderRadius = '6px';
        explanation.style.fontSize = '0.9em';

        // Confidence score
        if (this.analysisResult.confidence_score) {
            const confidence = contentEl.createEl('div', {
                text: `AI Confidence: ${Math.round(this.analysisResult.confidence_score * 100)}%`
            });
            confidence.style.marginBottom = '15px';
            confidence.style.fontSize = '0.85em';
            confidence.style.color = 'var(--text-muted)';
        }

        // Primary hierarchy
        this.createHierarchyOption(contentEl, this.analysisResult.primary_hierarchy, true, '🎯 Primary Recommendation');

        // Alternative hierarchies
        if (this.analysisResult.alternative_hierarchies?.length > 0) {
            contentEl.createEl('h3', { text: '🔄 Alternative Placements' });
            this.analysisResult.alternative_hierarchies.forEach((alt: any, index: number) => {
                this.createHierarchyOption(contentEl, alt, false, `Alternative ${index + 1} (${Math.round(alt.strength * 100)}% strength)`);
            });
        }

        // Multiple selection option
        const multipleContainer = contentEl.createEl('div', { cls: 'multiple-selection-container' });
        multipleContainer.style.marginTop = '20px';
        multipleContainer.style.marginBottom = '20px';
        multipleContainer.style.padding = '12px';
        multipleContainer.style.border = '1px solid var(--background-modifier-border)';
        multipleContainer.style.borderRadius = '6px';

        const multipleCheckbox = multipleContainer.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
        multipleCheckbox.style.marginRight = '8px';
        multipleContainer.createEl('span', { text: 'Allow multiple hierarchy placement (creates links in both locations)' });

        multipleCheckbox.addEventListener('change', () => {
            this.allowMultiple = multipleCheckbox.checked;
            this.updateButtons();
        });

        // Buttons
        const buttonContainer = contentEl.createEl('div', { cls: 'hierarchy-choice-buttons' });
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        this.confirmButton = buttonContainer.createEl('button', { text: 'Confirm Selection' });
        this.confirmButton.style.backgroundColor = 'var(--interactive-accent)';
        this.confirmButton.style.color = 'var(--text-on-accent)';
        this.confirmButton.disabled = true;
        this.confirmButton.addEventListener('click', () => this.handleConfirm());
    }

    private createHierarchyOption(containerEl: HTMLElement, hierarchy: any, isPrimary: boolean, title: string) {
        const optionContainer = containerEl.createEl('div', { cls: 'hierarchy-option' });
        optionContainer.style.marginBottom = '15px';
        optionContainer.style.padding = '12px';
        optionContainer.style.border = isPrimary ? '2px solid var(--interactive-accent)' : '1px solid var(--background-modifier-border)';
        optionContainer.style.borderRadius = '6px';
        optionContainer.style.cursor = 'pointer';

        const titleEl = optionContainer.createEl('h4', { text: title });
        titleEl.style.marginBottom = '8px';
        titleEl.style.color = isPrimary ? 'var(--interactive-accent)' : 'var(--text-normal)';

        // Hierarchy path
        const pathParts = [hierarchy.level1, hierarchy.level2, hierarchy.level3, hierarchy.level4].filter(Boolean);
        const pathEl = optionContainer.createEl('div', { text: pathParts.join(' > ') });
        pathEl.style.fontWeight = '500';
        pathEl.style.marginBottom = '6px';

        // Reasoning
        if (hierarchy.reasoning) {
            const reasoningEl = optionContainer.createEl('div', { text: hierarchy.reasoning });
            reasoningEl.style.fontSize = '0.85em';
            reasoningEl.style.color = 'var(--text-muted)';
            reasoningEl.style.fontStyle = 'italic';
        }

        // Radio button for single selection
        const radio = optionContainer.createEl('input', { type: 'radio' }) as HTMLInputElement;
        radio.name = 'hierarchy-choice';
        radio.value = JSON.stringify(hierarchy);
        radio.style.marginTop = '8px';

        if (isPrimary) {
            radio.checked = true;
            this.result = {
                hierarchy: hierarchy as MOCHierarchy,
                learning_context: this.analysisResult.learning_context
            };
            this.updateButtons();
        }

        radio.addEventListener('change', () => {
            if (radio.checked) {
                this.result = {
                    hierarchy: hierarchy as MOCHierarchy,
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