import * as vscode from 'vscode';
import { RecentTicket, LLMResponse } from '../types';
import { OllamaProvider } from '../llm/ollama';
import { OpenRouterProvider } from '../llm/openrouter';
import { ContextBuilder } from '../contextBuilder';
import { StreamingPanel } from './streamingPanel';
import { taskQueue } from '../utils/taskQueue';
import { feedbackSystem } from './feedbackSystem';
import { ErrorFactory, ExtensionError } from '../utils/errorTypes';
import { errorHandler } from './errorHandler';
import { getProviderConfig } from '../config/environment';

export class PlanGenerator {
  private contextBuilder: ContextBuilder;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.contextBuilder = new ContextBuilder();
    this.outputChannel = vscode.window.createOutputChannel('AI Plan');
  }

  async generatePlan(ticket: RecentTicket): Promise<void> {
    const taskId = `plan-generation-${ticket.key}-${Date.now()}`;
    
    try {
      // Queue the plan generation as a background task
      const taskResult = await taskQueue.enqueue({
        id: taskId,
        name: `Generate Plan for ${ticket.key}`,
        priority: 'high',
        timeout: 120000, // 2 minutes
        operation: async () => {
          return this.generatePlanInternal(ticket);
        }
      });

      if (taskResult.status === 'completed' && taskResult.result) {
        // Show the generated plan
        await this.showPlan(ticket, taskResult.result);
      } else if (taskResult.status === 'failed' && taskResult.error) {
        await errorHandler.handleExtensionError(taskResult.error);
      }

    } catch (error) {
      const extensionError = error instanceof ExtensionError 
        ? error 
        : ErrorFactory.workspaceError('PlanGenerator', 'generate_plan', error.message);
      
      await errorHandler.handleExtensionError(extensionError);
    }
  }

  private async generatePlanInternal(ticket: RecentTicket): Promise<{ plan: string; context: string }> {
    return await feedbackSystem.showProgress(
      `Generating plan for ${ticket.key}`,
      async (progress) => {
        progress.report({ message: 'Building workspace context...', increment: 20 });
        
        // Build context
        const context = await this.contextBuilder.buildContext();
        
        progress.report({ message: 'Initializing AI provider...', increment: 40 });
        
        // Get LLM provider based on configuration
        const llmProvider = this.createLLMProvider();
        
        progress.report({ message: 'Generating implementation plan...', increment: 60 });
        
        // Generate plan
        const response = await llmProvider.generatePlan(ticket, context, undefined, {});
        
        progress.report({ message: 'Plan generated successfully!', increment: 100 });
        
        return { plan: response.content, context };
      },
      { cancellable: true }
    );
  }

  private createLLMProvider() {
    // Try OpenRouter first if configured
    const openRouterConfig = getProviderConfig('openRouter');
    if (openRouterConfig.apiKey) {
      return new OpenRouterProvider({
        apiKey: openRouterConfig.apiKey,
        model: openRouterConfig.model
      });
    }

    // Fall back to Ollama
    const ollamaConfig = getProviderConfig('ollama');
    return new OllamaProvider({
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.model
    });
  }

  private async showPlan(ticket: RecentTicket, result: { plan: string; context: string }): Promise<void> {
    try {
      // Create a new markdown document with the plan
      const planDocument = await vscode.workspace.openTextDocument({
        content: this.formatPlanDocument(ticket, result.plan, result.context),
        language: 'markdown'
      });

      // Show the document
      await vscode.window.showTextDocument(planDocument, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
      });

      // Show success notification
      await feedbackSystem.showSuccess(
        `Implementation plan generated for ${ticket.key}`,
        {
          title: 'Plan Generated',
          actions: [
            {
              label: 'View in Browser',
              action: async () => {
                if (ticket.url) {
                  await vscode.env.openExternal(vscode.Uri.parse(ticket.url));
                }
              }
            }
          ]
        }
      );

    } catch (error) {
      const extensionError = error instanceof ExtensionError 
        ? error 
        : ErrorFactory.workspaceError('PlanGenerator', 'show_plan', error.message);
      
      await errorHandler.handleExtensionError(extensionError);
    }
  }

  private formatPlanDocument(ticket: RecentTicket, plan: string, context: string): string {
    const timestamp = new Date().toISOString();
    
    return `# Implementation Plan: ${ticket.summary}

**Generated:** ${timestamp}
**Ticket:** ${ticket.key} (${ticket.provider})
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}

## Ticket Description
${ticket.description || 'No description provided'}

**Labels:** ${ticket.labels.length > 0 ? ticket.labels.join(', ') : 'None'}
**URL:** ${ticket.url}

---

${plan}

---

## Workspace Context Summary
\`\`\`
${context.substring(0, 1000)}${context.length > 1000 ? '...\n(Context truncated for display)' : ''}
\`\`\`

---
*Generated by AI Plan Extension*
`;
  }

  private formatEnhancedPrompt(ticket: RecentTicket, context: string): string {
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

  private async displayPlan(ticket: RecentTicket, planContent: string): Promise<void> {
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

  async selectLLMProvider(): Promise<string> {
    const providers = [
      { label: 'Ollama (Local)', value: 'ollama' },
      { label: 'OpenRouter (Cloud)', value: 'openrouter' }
    ];

    const selected = await vscode.window.showQuickPick(providers, {
      placeHolder: 'Select AI provider for plan generation...'
    });

    return selected?.value || 'ollama';
  }

  async configureLLMProvider(provider: string): Promise<any> {
    if (provider === 'ollama') {
      // Check if Ollama is running
      const ollamaProvider = new OllamaProvider({});
      const isValid = await ollamaProvider.validateConfig();
      
      if (!isValid) {
        await vscode.window.showErrorMessage(
          'Ollama is not running or not accessible. Please start Ollama and ensure it\'s running on localhost:11434'
        );
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

  private async displayStreaming(
    ticket: RecentTicket,
    runStream: (append: (chunk: string) => void) => Promise<void>
  ): Promise<void> {
    const panel = new StreamingPanel('AI Plan (Streaming)');
    panel.setHeader(`Generating plan for ${ticket.key} - ${ticket.summary}`);

    await runStream((chunk) => panel.appendToken(chunk));
    panel.finish();
  }
}
