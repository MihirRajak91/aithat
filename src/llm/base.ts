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
}
