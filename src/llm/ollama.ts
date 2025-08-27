import { BaseLLM } from './base';
import { LLMResponse } from '../types';

export class OllamaProvider extends BaseLLM {
  getProviderName(): string {
    return 'ollama';
  }

  async validateConfig(): Promise<boolean> {
    try {
      const { default: axios } = await import('axios');
      await axios.get('http://localhost:11434/api/tags');
      return true;
    } catch (error) {
      return false;
    }
  }

  async generatePlan(prompt: string): Promise<LLMResponse> {
    const model = this.config.model || 'llama2:13b';
    
    try {
      const { default: axios } = await import('axios');
      
      const response = await axios.post('http://localhost:11434/api/generate', {
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }
      });

      return {
        content: response.data.response,
        isStreaming: false
      };
    } catch (error) {
      console.error('Error generating plan with Ollama:', error);
      throw new Error('Failed to generate plan with Ollama. Make sure Ollama is running and the model is available.');
    }
  }

  protected async makeRequest(prompt: string): Promise<any> {
    // This method is not used in Ollama implementation
    // as we handle the request directly in generatePlan
    throw new Error('makeRequest not implemented for Ollama');
  }

  // Streaming using Ollama's SSE-style chunked responses (NDJSON lines)
  async streamGeneratePlan(
    prompt: string,
    onToken: (token: string) => void
  ): Promise<LLMResponse> {
    const model = this.config.model || 'llama2:13b';
    const url = 'http://localhost:11434/api/generate';
    try {
      const { default: axios } = await import('axios');
      const response = await axios.post(url, {
        model,
        prompt,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }
      }, { responseType: 'stream' as any });

      let full = '';
      const stream = response.data as NodeJS.ReadableStream;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          // Ollama streams NDJSON lines: { response: "...", done: bool, ... }
          for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed) {continue;}
            try {
              const obj = JSON.parse(trimmed);
              if (obj.response) {
                full += obj.response;
                try { onToken(obj.response); } catch {}
              }
              if (obj.done) {
                // do nothing; wait for end
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: any) => reject(err));
      });

      return { content: full, isStreaming: true };
    } catch (error) {
      console.error('Error streaming plan with Ollama:', error);
      throw new Error('Failed to stream plan with Ollama. Ensure Ollama is running on localhost:11434');
    }
  }
}
