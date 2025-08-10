"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLLM = void 0;
class BaseLLM {
    constructor(config) {
        this.config = config;
    }
    formatPrompt(ticket, context) {
        return `Ticket: ${ticket.key} – ${ticket.summary}
${ticket.description}
---  
Workspace context:
${context}
---  
Return a concise, numbered checklist to implement this ticket.`;
    }
    // Default streaming behavior: fall back to non-streaming implementation
    async streamGeneratePlan(prompt, onToken) {
        const response = await this.generatePlan(prompt);
        try {
            onToken(response.content);
        }
        catch {
            // Swallow UI callback errors to not break generation
        }
        return { content: response.content, isStreaming: false };
    }
}
exports.BaseLLM = BaseLLM;
//# sourceMappingURL=base.js.map