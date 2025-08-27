/**
 * OpenRouter LLM provider for cloud-based AI models
 * Supports multiple models through OpenRouter API
 */

import { BaseLLMProvider, LLMResponse } from './base';
import { RecentTicket } from '../types';
import { ErrorFactory } from '../utils/errorTypes';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterChoice {
  message: OpenRouterMessage;
  finish_reason: string;
}

export interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  id: string;
  object: string;
  created: number;
  model: string;
}

/**
 * OpenRouter provider for accessing various cloud AI models
 */
export class OpenRouterProvider extends BaseLLMProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: OpenRouterConfig) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.model = config.model || 'anthropic/claude-3-sonnet-20240229';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a minimal request
      const response = await this.makeRequest('/models', {
        method: 'GET'
      });
      
      return Array.isArray(response.data) && response.data.length > 0;
    } catch (error) {
      console.error('OpenRouter validation failed:', error);
      return false;
    }
  }

  async generatePlan(
    ticket: RecentTicket,
    context: string,
    customPrompt?: string,
    _options?: any
  ): Promise<LLMResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = customPrompt || this.buildUserPrompt(ticket, context);

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const requestBody = {
        model: this.model,
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      };

      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        data: requestBody
      });

      const openRouterResponse = response as OpenRouterResponse;
      
      if (!openRouterResponse.choices || openRouterResponse.choices.length === 0) {
        throw ErrorFactory.invalidResponse('OpenRouterProvider', 'No choices in response');
      }

      const content = openRouterResponse.choices[0].message.content;
      
      if (!content) {
        throw ErrorFactory.invalidResponse('OpenRouterProvider', 'Empty response content');
      }

      return {
        content,
        isStreaming: false
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.connectionFailed('OpenRouterProvider', `OpenRouter request failed: ${message}`);
    }
  }

  /**
   * Generate plan with streaming support
   */
  async generatePlanStreaming(
    ticket: RecentTicket,
    context: string,
    onToken: (token: string) => void,
    customPrompt?: string
  ): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = customPrompt || this.buildUserPrompt(ticket, context);

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const requestBody = {
        model: this.model,
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true
      };

      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        data: requestBody,
        responseType: 'stream'
      });

      let fullContent = '';
      const stream = response.data;

      return new Promise<string>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          const lines = text.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) {
              continue;
            }

            const data = trimmed.slice(6); // Remove 'data: ' prefix
            if (data === '[DONE]') {
              resolve(fullContent);
              return;
            }

            try {
              const parsed = JSON.parse(data) as OpenRouterResponse;
              const delta = parsed.choices[0]?.message?.content;
              
              if (delta) {
                fullContent += delta;
                onToken(delta);
              }
            } catch (parseError) {
              console.debug('Ignoring malformed JSON line:', data);
            }
          }
        });

        stream.on('error', (error: Error) => {
          reject(ErrorFactory.connectionFailed('OpenRouterProvider', `Stream error: ${error.message}`));
        });

        stream.on('end', () => {
          resolve(fullContent);
        });
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.connectionFailed('OpenRouterProvider', `Streaming request failed: ${message}`);
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<Array<{ id: string; name: string; context_length: number }>> {
    try {
      const response = await this.makeRequest('/models', {
        method: 'GET'
      });

      return response.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        context_length: model.context_length || 4000
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.connectionFailed('OpenRouterProvider', `Failed to fetch models: ${message}`);
    }
  }

  /**
   * Get current model information
   */
  getCurrentModel(): string {
    return this.model;
  }

  protected async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const { default: axios } = await import('axios');
    
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      url,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/your-extension/ai-plan',
        'X-Title': 'AI Plan VS Code Extension',
        ...options.headers
      },
      timeout: 60000, // 60 seconds for LLM requests
      ...options
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw ErrorFactory.authenticationFailed('OpenRouterProvider', 'Invalid API key');
        } else if (status === 429) {
          throw ErrorFactory.rateLimited('OpenRouterProvider', 'openrouter');
        } else if (status >= 500) {
          throw ErrorFactory.connectionFailed('OpenRouterProvider', 'OpenRouter server error');
        } else {
          throw ErrorFactory.invalidResponse('OpenRouterProvider', `HTTP ${status}: ${data?.error?.message || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw ErrorFactory.rateLimited('OpenRouterProvider', 'openrouter'); // Treat timeout as rate limit
      } else {
        throw ErrorFactory.connectionFailed('OpenRouterProvider', `Network error: ${error.message}`);
      }
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert software engineer and project manager. Your task is to create detailed implementation plans based on tickets/issues from project management tools.

Your response should be a well-structured markdown document that includes:

## 📋 Implementation Plan

### Overview
- Brief summary of what needs to be implemented
- Key objectives and success criteria

### Technical Approach
- High-level technical strategy
- Architecture decisions and rationale
- Technology stack considerations

### Implementation Steps
1. **Step 1: [Name]**
   - Detailed description
   - Specific tasks
   - Expected outcome

2. **Step 2: [Name]**
   - Detailed description  
   - Specific tasks
   - Expected outcome

(Continue with additional steps as needed)

### Testing Strategy
- Unit testing approach
- Integration testing considerations
- End-to-end testing plan

### Deployment Plan
- Deployment steps
- Environment considerations
- Rollback strategy

### Risks & Considerations
- Potential challenges
- Mitigation strategies
- Dependencies

### Timeline Estimate
- Rough time estimates for each phase
- Critical path items

Be specific, actionable, and consider the existing codebase context provided.`;
  }

  private buildUserPrompt(ticket: RecentTicket, context: string): string {
    return `Please create an implementation plan for the following ticket:

**Ticket Information:**
- **ID:** ${ticket.key}
- **Title:** ${ticket.summary}
- **Description:** ${ticket.description}
- **Priority:** ${ticket.priority}
- **Status:** ${ticket.status}
- **Labels:** ${ticket.labels.join(', ')}
- **Provider:** ${ticket.provider}

**Current Codebase Context:**
\`\`\`
${context}
\`\`\`

Please analyze the ticket requirements in the context of the existing codebase and create a comprehensive implementation plan. Focus on practical, actionable steps that a developer can follow immediately.`;
  }
}