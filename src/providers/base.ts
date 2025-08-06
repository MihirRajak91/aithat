import { RecentTicket } from '../types';

export abstract class BaseProvider {
  protected config: {
    baseUrl?: string;
    token?: string;
  };

  constructor(config: { baseUrl?: string; token?: string }) {
    this.config = config;
  }

  abstract getRecentTickets(limit?: number): Promise<RecentTicket[]>;
  abstract getTicket(id: string): Promise<RecentTicket>;
  abstract validateConfig(): Promise<boolean>;
  abstract getProviderName(): string;

  protected abstract mapToRecentTicket(rawTicket: any): RecentTicket;

  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json'
    };
  }

  protected async makeRequest(url: string, options: any = {}): Promise<any> {
    const { default: axios } = await import('axios');
    
    try {
      const response = await axios({
        url,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        },
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw error;
    }
  }
}
