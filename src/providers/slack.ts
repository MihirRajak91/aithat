/**
 * Slack Provider for AI Plan Extension
 * 
 * This provider integrates with Slack's Web API to retrieve task-related messages
 * and discussions for generating AI implementation plans. It includes intelligent
 * task identification, caching for performance, and comprehensive error handling.
 * 
 * @author AI Plan Extension
 * @version 1.0.0
 */

import { WebClient } from '@slack/web-api';
import { BaseProvider } from './base';
import { 
  RecentTicket, 
  SlackChannel, 
  SlackTask, 
  SlackConfig,
  SlackUser,
  SlackCacheEntry 
} from '../types';
import {
  SLACK_CACHE_DURATION,
  SLACK_BATCH_SIZE,
  MAX_CHANNELS_TO_PROCESS,
  // MAX_BOARDS_LIMIT, // TODO: Use when implementing board-like features
  DEFAULT_THREAD_REPLIES_LIMIT,
  SLACK_ERROR_MESSAGES
} from '../constants/slack';
import {
  SlackLogger,
  SlackTextProcessor,
  SlackTaskAnalyzer,
  SlackChannelFilter,
  SlackTimeUtils,
  SlackUrlGenerator,
  SlackValidator
} from '../utils/slackUtils';

/**
 * Slack provider implementation for retrieving and processing task-related messages
 */
export class SlackProvider extends BaseProvider {
  // =================== PRIVATE PROPERTIES ===================
  
  /** Slack Web API client instance */
  private readonly client: WebClient;
  
  /** In-memory cache for API responses */
  private readonly messageCache = new Map<string, SlackCacheEntry>();
  
  /** Current authenticated user information */
  private currentUser: SlackUser | null = null;

  // =================== CONSTRUCTOR ===================

  /**
   * Creates a new SlackProvider instance
   * @param config - Slack configuration including bot token
   */
  constructor(config: SlackConfig) {
    super(config);
    
    if (!SlackValidator.isValidBotToken(config.token)) {
      SlackLogger.warn('Invalid bot token format provided');
    }
    
    this.client = new WebClient(config.token, {
      retryConfig: {
        retries: 3,
        factor: 2
      }
    });

    SlackLogger.info('SlackProvider initialized');
  }

  // =================== PUBLIC API METHODS ===================

  /**
   * Gets the provider name identifier
   * @returns The provider name
   */
  getProviderName(): string {
    return 'slack';
  }

  /**
   * Validates the Slack configuration and connection
   * @returns Promise resolving to validation result
   */
  async validateConfig(): Promise<boolean> {
    if (!this.config.token) {
      SlackLogger.error('No token provided in configuration');
      return false;
    }

    try {
      SlackLogger.debug('Validating Slack configuration...');
      const auth = await this.client.auth.test();
      
      if (!auth.ok) {
        SlackLogger.error('Auth test failed:', auth.error);
        return false;
      }

      // Cache user information for later use
      this.currentUser = {
        id: auth.user_id as string,
        name: auth.user as string
      };

      SlackLogger.info('Slack configuration validated successfully', {
        user: this.currentUser.name,
        team: auth.team
      });
      
      return true;
    } catch (error) {
      SlackLogger.error('Slack validation failed:', error);
      return false;
    }
  }

  /**
   * Retrieves a specific ticket by ID (not implemented for Slack)
   * @param id - The message timestamp ID
   * @returns Promise that rejects with not implemented error
   */
  async getTicket(id: string): Promise<RecentTicket> {
    SlackLogger.warn(`getTicket called with ID: ${id} - not implemented for Slack`);
    throw new Error('getTicket not implemented for Slack - use search methods instead');
  }

  /**
   * Retrieves recent task-related messages from Slack
   * @param limit - Maximum number of tasks to retrieve
   * @returns Promise resolving to array of recent tickets
   */
  async getRecentTickets(limit: number = 10): Promise<RecentTicket[]> {
    SlackLogger.debug(`Fetching ${limit} recent tickets`);
    
    const cacheKey = `recent-tasks-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      try {
        const taskChannels = await this.getTaskChannels();
        const allTasks: RecentTicket[] = [];

        // Process channels with concurrency control
        const channelsToProcess = taskChannels.slice(0, MAX_CHANNELS_TO_PROCESS);
        const tasksPerChannel = Math.ceil(limit / channelsToProcess.length);

        const channelPromises = channelsToProcess.map(async (channelId) => {
          try {
            return await this.getTasksFromChannel(channelId, tasksPerChannel);
          } catch (error) {
            SlackLogger.error(`Error fetching tasks from channel ${channelId}:`, error);
            return [];
          }
        });

        const channelResults = await Promise.all(channelPromises);
        for (const tasks of channelResults) {
          allTasks.push(...tasks);
        }

        // Sort by updated time and limit results
        const sortedTasks = allTasks
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, limit);

        SlackLogger.info(`Retrieved ${sortedTasks.length} recent tasks from ${channelsToProcess.length} channels`);
        return sortedTasks;
        
      } catch (error) {
        SlackLogger.error('Failed to fetch recent tickets:', error);
        throw new Error(SLACK_ERROR_MESSAGES.NETWORK_ERROR);
      }
    });
  }

  // =================== SPECIALIZED QUERY METHODS ===================

  /**
   * Retrieves task-related mentions of the current user
   * @param days - Number of days to look back (default: 7)
   * @param limit - Maximum number of mentions to retrieve (default: 20)
   * @returns Promise resolving to array of mentioned tasks
   */
  async getMyTaskMentions(days: number = 7, limit: number = 20): Promise<RecentTicket[]> {
    SlackLogger.debug(`Fetching task mentions for last ${days} days`);
    
    const cacheKey = `my-mentions-${days}-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      if (!this.currentUser) {
        await this.validateConfig();
        if (!this.currentUser) {
          throw new Error('Unable to determine current user');
        }
      }

      try {
        const query = SlackValidator.sanitizeSearchQuery(
          `from:@${this.currentUser.name} OR mentions:@${this.currentUser.name}`
        );
        
        const result = await this.client.search.messages({
          query,
          count: limit,
          sort: 'timestamp',
          sort_dir: 'desc'
        });

        if (!result.ok) {
          throw new Error(result.error || 'Search failed');
        }

        const tasks = await this.processSearchResults(result.messages?.matches || []);
        SlackLogger.info(`Retrieved ${tasks.length} task mentions`);
        return tasks;
        
      } catch (error) {
        SlackLogger.error('Failed to fetch task mentions:', error);
        throw new Error(SLACK_ERROR_MESSAGES.NETWORK_ERROR);
      }
    });
  }

  /**
   * Retrieves tasks from a specific Slack channel
   * @param channelId - The channel ID to search
   * @param limit - Maximum number of tasks to retrieve (default: 20)
   * @returns Promise resolving to array of channel tasks
   */
  async getTasksByChannel(channelId: string, limit: number = 20): Promise<RecentTicket[]> {
    if (!SlackValidator.isValidChannelId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    SlackLogger.debug(`Fetching ${limit} tasks from channel ${channelId}`);
    
    const cacheKey = `channel-tasks-${channelId}-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      return await this.getTasksFromChannel(channelId, limit);
    });
  }

  /**
   * Searches for tasks using text query
   * @param query - Search query string
   * @param limit - Maximum number of results (default: 20)
   * @returns Promise resolving to array of matching tasks
   */
  async searchTasks(query: string, limit: number = 20): Promise<RecentTicket[]> {
    const sanitizedQuery = SlackValidator.sanitizeSearchQuery(query);
    SlackLogger.debug(`Searching for tasks with query: "${sanitizedQuery}"`);
    
    const cacheKey = `search-${sanitizedQuery}-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      try {
        // Enhance query with task-related keywords
        const enhancedQuery = `${sanitizedQuery} (TODO OR task OR bug OR feature OR urgent OR priority)`;
        
        const result = await this.client.search.messages({
          query: enhancedQuery,
          count: limit,
          sort: 'timestamp',
          sort_dir: 'desc'
        });

        if (!result.ok) {
          throw new Error(result.error || 'Search failed');
        }

        const tasks = await this.processSearchResults(result.messages?.matches || []);
        SlackLogger.info(`Search returned ${tasks.length} tasks for query: "${query}"`);
        return tasks;
        
      } catch (error) {
        SlackLogger.error(`Search failed for query "${query}":`, error);
        throw new Error(SLACK_ERROR_MESSAGES.NETWORK_ERROR);
      }
    });
  }

  /**
   * Retrieves high priority tasks from all accessible channels
   * @param limit - Maximum number of tasks to retrieve (default: 20)
   * @returns Promise resolving to array of high priority tasks
   */
  async getHighPriorityTasks(limit: number = 20): Promise<RecentTicket[]> {
    SlackLogger.debug(`Fetching ${limit} high priority tasks`);
    
    const cacheKey = `high-priority-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      try {
        const query = '🔥 OR urgent OR critical OR "high priority" OR emergency';
        
        const result = await this.client.search.messages({
          query,
          count: limit * 2, // Get more to filter
          sort: 'timestamp',
          sort_dir: 'desc'
        });

        if (!result.ok) {
          throw new Error(result.error || 'Search failed');
        }

        const allTasks = await this.processSearchResults(result.messages?.matches || []);
        
        // Filter for only high and urgent priority tasks
        const highPriorityTasks = allTasks
          .filter(task => ['high', 'urgent'].includes(task.priority))
          .slice(0, limit);

        SlackLogger.info(`Retrieved ${highPriorityTasks.length} high priority tasks`);
        return highPriorityTasks;
        
      } catch (error) {
        SlackLogger.error('Failed to fetch high priority tasks:', error);
        throw new Error(SLACK_ERROR_MESSAGES.NETWORK_ERROR);
      }
    });
  }

  /**
   * Retrieves list of task-related channel IDs
   * @returns Promise resolving to array of channel IDs
   */
  async getTaskChannels(): Promise<string[]> {
    const cacheKey = 'task-channels';
    return this.getCachedData(cacheKey, async () => {
      try {
        SlackLogger.debug('Fetching task-related channels');
        
        const result = await this.client.conversations.list({
          types: 'public_channel,private_channel',
          limit: 200
        });

        if (!result.ok || !result.channels) {
          throw new Error(result.error || 'Failed to fetch channels');
        }

        const taskChannels = SlackChannelFilter.filterTaskChannels(result.channels as SlackChannel[]);
        const sortedChannels = SlackChannelFilter.sortChannelsByRelevance(taskChannels);
        const channelIds = sortedChannels.map(channel => channel.id);

        SlackLogger.info(`Found ${channelIds.length} task-related channels`);
        return channelIds;
        
      } catch (error) {
        SlackLogger.error('Failed to fetch task channels:', error);
        return [];
      }
    });
  }

  // =================== PRIVATE HELPER METHODS ===================

  /**
   * Retrieves tasks from a specific channel with intelligent filtering
   * @private
   */
  private async getTasksFromChannel(channelId: string, limit: number): Promise<RecentTicket[]> {
    try {
      SlackLogger.debug(`Fetching messages from channel ${channelId}`);
      
      const result = await this.client.conversations.history({
        channel: channelId,
        limit: SLACK_BATCH_SIZE
      });

      if (!result.ok || !result.messages) {
        SlackLogger.warn(`Failed to fetch messages from channel ${channelId}: ${result.error}`);
        return [];
      }

      const channelInfo = await this.getChannelInfo(channelId);
      const tasks: RecentTicket[] = [];

      for (const message of result.messages.slice(0, limit)) {
        const analysis = SlackTaskAnalyzer.analyzeMessage(message as SlackTask);
        
        if (analysis.isTask) {
          // Enhance message with thread replies if available
          const enhancedMessage = await this.enhanceMessageWithThread(
            message as SlackTask, 
            channelId
          );
          
          const ticket = this.convertSlackMessageToTicket(enhancedMessage, channelInfo);
          tasks.push(ticket);
          
          SlackLogger.debug(`Identified task: ${ticket.key} (confidence: ${analysis.confidence})`);
        }
      }

      return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
    } catch (error) {
      SlackLogger.error(`Error fetching tasks from channel ${channelId}:`, error);
      return [];
    }
  }

  /**
   * Processes search results and converts valid tasks to tickets
   * @private
   */
  private async processSearchResults(matches: any[]): Promise<RecentTicket[]> {
    const tasks: RecentTicket[] = [];
    
    for (const match of matches) {
      try {
        const analysis = SlackTaskAnalyzer.analyzeMessage(match);
        
        if (analysis.isTask) {
          const channelId = match.channel?.id || '';
          const channelInfo = await this.getChannelInfo(channelId);
          const ticket = this.convertSlackMessageToTicket(match, channelInfo);
          tasks.push(ticket);
        }
      } catch (error) {
        SlackLogger.warn('Error processing search result:', error);
      }
    }
    
    return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Enhances a message with thread replies for better context
   * @private
   */
  private async enhanceMessageWithThread(
    message: SlackTask, 
    channelId: string
  ): Promise<SlackTask> {
    if (!message.thread_ts || message.thread_ts === message.ts) {
      return message;
    }

    try {
      const replies = await this.client.conversations.replies({
        channel: channelId,
        ts: message.thread_ts,
        limit: DEFAULT_THREAD_REPLIES_LIMIT
      });

      if (replies.ok && replies.messages) {
        return {
          ...message,
          thread_replies: replies.messages.slice(1) // Exclude parent message
        };
      }
    } catch (error) {
      SlackLogger.warn('Error fetching thread replies:', error);
    }

    return message;
  }

  /**
   * Retrieves channel information with caching
   * @private
   */
  private async getChannelInfo(channelId: string): Promise<SlackChannel> {
    if (!channelId) {
      return { id: 'unknown', name: 'unknown', is_private: false, is_archived: false };
    }

    const cacheKey = `channel-${channelId}`;
    return this.getCachedData(cacheKey, async () => {
      try {
        const result = await this.client.conversations.info({ channel: channelId });
        
        if (result.ok && result.channel) {
          return result.channel as SlackChannel;
        }
      } catch (error) {
        SlackLogger.warn(`Error fetching channel info for ${channelId}:`, error);
      }

      return { 
        id: channelId, 
        name: 'unknown', 
        is_private: false, 
        is_archived: false 
      };
    });
  }

  /**
   * Converts a Slack message to a RecentTicket
   * @private
   */
  private convertSlackMessageToTicket(
    message: SlackTask, 
    channel: SlackChannel
  ): RecentTicket {
    const analysis = SlackTaskAnalyzer.analyzeMessage(message);
    const messageId = message.ts.replace('.', '');
    
    return {
      id: message.ts,
      key: `SLACK-${channel.name || 'DM'}-${messageId}`,
      summary: SlackTextProcessor.extractSummary(message.text),
      description: SlackTextProcessor.cleanMessageText(message.text),
      provider: 'slack',
      priority: analysis.metadata.priority || 'medium',
      assignee: analysis.metadata.assignee,
      labels: analysis.metadata.labels || [],
      createdAt: SlackTimeUtils.timestampToDate(message.ts),
      updatedAt: SlackTimeUtils.getLastActivityDate(message),
      url: SlackUrlGenerator.generateMessageUrl(channel.id, message.ts),
      status: analysis.metadata.status || 'open'
    };
  }

  // =================== BASE CLASS IMPLEMENTATION ===================

  /**
   * Maps raw ticket data to RecentTicket format (required by base class)
   * @protected
   */
  protected mapToRecentTicket(rawTicket: any): RecentTicket {
    // Handle enhanced ticket data with channel info
    if (rawTicket.channel) {
      return this.convertSlackMessageToTicket(rawTicket, rawTicket.channel);
    }
    
    // Fallback for base class compatibility
    return this.convertSlackMessageToTicket(rawTicket, { 
      id: 'unknown', 
      name: 'unknown', 
      is_private: false, 
      is_archived: false 
    });
  }

  /**
   * Override makeRequest to prevent usage (we use WebClient directly)
   * @protected
   */
  protected async makeRequest(_url: string, _options: any = {}): Promise<any> {
    throw new Error('Use Slack WebClient directly instead of makeRequest');
  }

  /**
   * Returns authentication headers (not used with WebClient)
   * @protected
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json; charset=utf-8'
    };
  }

  // =================== CACHE MANAGEMENT ===================

  /**
   * Retrieves data from cache or fetches new data
   * @private
   */
  private async getCachedData<T>(
    key: string, 
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.messageCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < SLACK_CACHE_DURATION) {
      SlackLogger.debug(`Cache hit for key: ${key}`);
      return cached.data as T;
    }
    
    SlackLogger.debug(`Cache miss for key: ${key}, fetching fresh data`);
    
    try {
      const data = await fetcher();
      this.messageCache.set(key, { 
        data, 
        timestamp: Date.now() 
      });
      return data;
    } catch (error) {
      SlackLogger.error(`Error fetching data for cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clears all cached data
   */
  public clearCache(): void {
    const size = this.messageCache.size;
    this.messageCache.clear();
    SlackLogger.info(`Cleared cache (${size} entries)`);
  }

  /**
   * Returns cache statistics for debugging
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.messageCache.size,
      keys: Array.from(this.messageCache.keys())
    };
  }
}