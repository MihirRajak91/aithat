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
}
