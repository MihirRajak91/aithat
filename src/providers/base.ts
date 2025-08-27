import { RecentTicket } from '../types';

/**
 * Base provider class for all ticket/task providers
 * Provides common functionality for API authentication, request handling, and data mapping
 */
export abstract class BaseProvider {
  protected config: {
    baseUrl?: string;
    token?: string;
  };

  /**
   * Initialize provider with configuration
   * @param config Provider configuration including authentication details
   */
  constructor(config: { baseUrl?: string; token?: string }) {
    this.config = config;
  }

  /**
   * Fetch recent tickets from the provider
   * @param limit Maximum number of tickets to retrieve
   * @returns Promise resolving to array of recent tickets
   */
  abstract getRecentTickets(limit?: number): Promise<RecentTicket[]>;
  
  /**
   * Fetch a specific ticket by ID
   * @param id Unique identifier for the ticket
   * @returns Promise resolving to the ticket details
   */
  abstract getTicket(id: string): Promise<RecentTicket>;
  
  /**
   * Validate the provider configuration
   * @returns Promise resolving to true if configuration is valid
   */
  abstract validateConfig(): Promise<boolean>;
  
  /**
   * Get the provider name identifier
   * @returns String identifier for this provider
   */
  abstract getProviderName(): string;

  /**
   * Map provider-specific ticket data to standard RecentTicket format
   * @param rawTicket Raw ticket data from provider API
   * @returns Standardized ticket object
   */
  protected abstract mapToRecentTicket(rawTicket: any): RecentTicket;

  /**
   * Generate authentication headers for API requests
   * @returns Object containing authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make authenticated HTTP request to provider API
   * @param url Target URL for the request
   * @param options Additional axios options (method, data, params, etc.)
   * @returns Promise resolving to response data
   * @throws Error if request fails or response is invalid
   */
  protected async makeRequest(url: string, options: any = {}): Promise<any> {
    const { default: axios } = await import('axios');
    
    try {
      const response = await axios({
        url,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        },
        timeout: 30000, // 30 second timeout
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      
      // Re-throw with more context
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        throw new Error(`HTTP ${status} ${statusText}: Request to ${url} failed`);
      } else if (error.request) {
        throw new Error(`Network error: Unable to reach ${url}`);
      } else {
        throw new Error(`Request configuration error: ${error.message}`);
      }
    }
  }
}
