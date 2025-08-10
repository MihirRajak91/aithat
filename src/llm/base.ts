import { LLMResponse } from '../types';

export abstract class BaseLLM {
  protected config: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.config = config;
  }

  abstract generatePlan(prompt: string): Promise<LLMResponse>;
  abstract validateConfig(): Promise<boolean>;
  abstract getProviderName(): string;

  protected abstract makeRequest(prompt: string): Promise<any>;

  protected formatPrompt(ticket: any, context: string): string {
    return `Ticket: ${ticket.key} – ${ticket.summary}
${ticket.description}
---  
Workspace context:
${context}
---  
Return a concise, numbered checklist to implement this ticket.`;
  }

  // Default streaming behavior: fall back to non-streaming implementation
  async streamGeneratePlan(
    prompt: string,
    onToken: (token: string) => void
  ): Promise<LLMResponse> {
    const response = await this.generatePlan(prompt);
    try {
      onToken(response.content);
    } catch {
      // Swallow UI callback errors to not break generation
    }
    return { content: response.content, isStreaming: false };
  }
}
