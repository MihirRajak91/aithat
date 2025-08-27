"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanGenerator = void 0;
const vscode = __importStar(require("vscode"));
const ollama_1 = require("../llm/ollama");
const contextBuilder_1 = require("../contextBuilder");
const streamingPanel_1 = require("./streamingPanel");
class PlanGenerator {
    constructor() {
        this.contextBuilder = new contextBuilder_1.ContextBuilder();
        this.outputChannel = vscode.window.createOutputChannel('AI Plan');
    }
    async generatePlan(ticket) {
        try {
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generating implementation plan...',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Building workspace context...' });
                // Build workspace context
                const context = await this.contextBuilder.buildContext();
                progress.report({ message: 'Generating plan with AI...' });
                // Initialize Ollama provider (local AI)
                const ollamaProvider = new ollama_1.OllamaProvider({
                    model: 'llama2:13b'
                });
                // Format prompt
                const prompt = this.formatEnhancedPrompt(ticket, context);
                // Stream plan into a webview panel styled like a chat window
                await this.displayStreaming(ticket, async (append) => {
                    await ollamaProvider.streamGeneratePlan(prompt, (token) => {
                        append(token);
                    });
                });
            });
        }
        catch (error) {
            console.error('Error generating plan:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await vscode.window.showErrorMessage(`Failed to generate plan: ${errorMessage}`);
        }
    }
    formatEnhancedPrompt(ticket, context) {
        return `# Implementation Plan Request

## Ticket Information
**Key:** ${ticket.key}
**Title:** ${ticket.summary}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}
**Provider:** ${ticket.provider}

**Description:**
${ticket.description || 'No description provided'}

**Labels:** ${ticket.labels.length > 0 ? ticket.labels.join(', ') : 'None'}

---

## Workspace Context
${context}

---

## Instructions
Generate a comprehensive, well-structured implementation plan for this ticket. Include:

1. **Overview** - Brief summary of what needs to be implemented
2. **Technical Analysis** - Key technical considerations and dependencies
3. **Implementation Steps** - Detailed, numbered checklist with:
   - Specific files to create or modify
   - Code changes required
   - Configuration updates
   - Database changes (if applicable)
4. **Testing Strategy** - How to test the implementation
5. **Deployment Notes** - Any deployment considerations
6. **Potential Risks** - What could go wrong and how to mitigate

Format the response in clear, actionable Markdown with proper headings, code blocks, and bullet points. Be specific about file paths, function names, and implementation details based on the workspace context provided.`;
    }
    async displayPlan(ticket, planContent) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `plan-${ticket.key}-${timestamp}.md`;
        const fullContent = `# Implementation Plan for ${ticket.key}

**Ticket:** ${ticket.key} - ${ticket.summary}
**Generated:** ${new Date().toLocaleString()}
**Provider:** ${ticket.provider}

## Plan

${planContent}

---
*Generated by AI Plan VS Code Extension*
`;
        // Create and open the document
        const document = await vscode.workspace.openTextDocument({
            content: fullContent,
            language: 'markdown'
        });
        const editor = await vscode.window.showTextDocument(document);
        // Show success message
        await vscode.window.showInformationMessage(`Plan generated for ${ticket.key}!`);
    }
    async selectLLMProvider() {
        const providers = [
            { label: 'Ollama (Local)', value: 'ollama' },
            { label: 'OpenRouter (Cloud)', value: 'openrouter' }
        ];
        const selected = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select AI provider for plan generation...'
        });
        return selected?.value || 'ollama';
    }
    async configureLLMProvider(provider) {
        if (provider === 'ollama') {
            // Check if Ollama is running
            const ollamaProvider = new ollama_1.OllamaProvider({});
            const isValid = await ollamaProvider.validateConfig();
            if (!isValid) {
                await vscode.window.showErrorMessage('Ollama is not running or not accessible. Please start Ollama and ensure it\'s running on localhost:11434');
                return null;
            }
            return { type: 'ollama', model: 'llama2:13b' };
        }
        // For OpenRouter, we would prompt for API key
        if (provider === 'openrouter') {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your OpenRouter API key',
                password: true
            });
            if (!apiKey) {
                return null;
            }
            return { type: 'openrouter', apiKey };
        }
        return null;
    }
    async displayStreaming(ticket, runStream) {
        const panel = new streamingPanel_1.StreamingPanel('AI Plan (Streaming)');
        panel.setHeader(`Generating plan for ${ticket.key} - ${ticket.summary}`);
        await runStream((chunk) => panel.appendToken(chunk));
        panel.finish();
    }
}
exports.PlanGenerator = PlanGenerator;
//# sourceMappingURL=planGenerator.js.map