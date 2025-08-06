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
}
exports.BaseLLM = BaseLLM;
//# sourceMappingURL=base.js.map