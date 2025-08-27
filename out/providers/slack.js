"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackProvider = void 0;
const web_api_1 = require("@slack/web-api");
const base_1 = require("./base");
const slack_1 = require("../constants/slack");
const slackUtils_1 = require("../utils/slackUtils");
/**
 * Slack provider implementation for retrieving and processing task-related messages
 */
class SlackProvider extends base_1.BaseProvider {
    // =================== CONSTRUCTOR ===================
    /**
     * Creates a new SlackProvider instance
     * @param config - Slack configuration including bot token
     */
    constructor(config) {
        super(config);
        /** In-memory cache for API responses */
        this.messageCache = new Map();
        /** Current authenticated user information */
        this.currentUser = null;
        if (!slackUtils_1.SlackValidator.isValidBotToken(config.token)) {
            slackUtils_1.SlackLogger.warn('Invalid bot token format provided');
        }
        this.client = new web_api_1.WebClient(config.token, {
            retryConfig: {
                retries: 3,
                factor: 2
            }
        });
        slackUtils_1.SlackLogger.info('SlackProvider initialized');
    }
    // =================== PUBLIC API METHODS ===================
    /**
     * Gets the provider name identifier
     * @returns The provider name
     */
    getProviderName() {
        return 'slack';
    }
    /**
     * Validates the Slack configuration and connection
     * @returns Promise resolving to validation result
     */
    async validateConfig() {
        if (!this.config.token) {
            slackUtils_1.SlackLogger.error('No token provided in configuration');
            return false;
        }
        try {
            slackUtils_1.SlackLogger.debug('Validating Slack configuration...');
            const auth = await this.client.auth.test();
            if (!auth.ok) {
                slackUtils_1.SlackLogger.error('Auth test failed:', auth.error);
                return false;
            }
            // Cache user information for later use
            this.currentUser = {
                id: auth.user_id,
                name: auth.user
            };
            slackUtils_1.SlackLogger.info('Slack configuration validated successfully', {
                user: this.currentUser.name,
                team: auth.team
            });
            return true;
        }
        catch (error) {
            slackUtils_1.SlackLogger.error('Slack validation failed:', error);
            return false;
        }
    }
    /**
     * Retrieves a specific ticket by ID (not implemented for Slack)
     * @param id - The message timestamp ID
     * @returns Promise that rejects with not implemented error
     */
    async getTicket(id) {
        slackUtils_1.SlackLogger.warn(`getTicket called with ID: ${id} - not implemented for Slack`);
        throw new Error('getTicket not implemented for Slack - use search methods instead');
    }
    /**
     * Retrieves recent task-related messages from Slack
     * @param limit - Maximum number of tasks to retrieve
     * @returns Promise resolving to array of recent tickets
     */
    async getRecentTickets(limit = 10) {
        slackUtils_1.SlackLogger.debug(`Fetching ${limit} recent tickets`);
        const cacheKey = `recent-tasks-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            try {
                const taskChannels = await this.getTaskChannels();
                const allTasks = [];
                // Process channels with concurrency control
                const channelsToProcess = taskChannels.slice(0, slack_1.MAX_CHANNELS_TO_PROCESS);
                const tasksPerChannel = Math.ceil(limit / channelsToProcess.length);
                const channelPromises = channelsToProcess.map(async (channelId) => {
                    try {
                        return await this.getTasksFromChannel(channelId, tasksPerChannel);
                    }
                    catch (error) {
                        slackUtils_1.SlackLogger.error(`Error fetching tasks from channel ${channelId}:`, error);
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
                slackUtils_1.SlackLogger.info(`Retrieved ${sortedTasks.length} recent tasks from ${channelsToProcess.length} channels`);
                return sortedTasks;
            }
            catch (error) {
                slackUtils_1.SlackLogger.error('Failed to fetch recent tickets:', error);
                throw new Error(slack_1.SLACK_ERROR_MESSAGES.NETWORK_ERROR);
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
    async getMyTaskMentions(days = 7, limit = 20) {
        slackUtils_1.SlackLogger.debug(`Fetching task mentions for last ${days} days`);
        const cacheKey = `my-mentions-${days}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            if (!this.currentUser) {
                await this.validateConfig();
                if (!this.currentUser) {
                    throw new Error('Unable to determine current user');
                }
            }
            try {
                const query = slackUtils_1.SlackValidator.sanitizeSearchQuery(`from:@${this.currentUser.name} OR mentions:@${this.currentUser.name}`);
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
                slackUtils_1.SlackLogger.info(`Retrieved ${tasks.length} task mentions`);
                return tasks;
            }
            catch (error) {
                slackUtils_1.SlackLogger.error('Failed to fetch task mentions:', error);
                throw new Error(slack_1.SLACK_ERROR_MESSAGES.NETWORK_ERROR);
            }
        });
    }
    /**
     * Retrieves tasks from a specific Slack channel
     * @param channelId - The channel ID to search
     * @param limit - Maximum number of tasks to retrieve (default: 20)
     * @returns Promise resolving to array of channel tasks
     */
    async getTasksByChannel(channelId, limit = 20) {
        if (!slackUtils_1.SlackValidator.isValidChannelId(channelId)) {
            throw new Error(`Invalid channel ID: ${channelId}`);
        }
        slackUtils_1.SlackLogger.debug(`Fetching ${limit} tasks from channel ${channelId}`);
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
    async searchTasks(query, limit = 20) {
        const sanitizedQuery = slackUtils_1.SlackValidator.sanitizeSearchQuery(query);
        slackUtils_1.SlackLogger.debug(`Searching for tasks with query: "${sanitizedQuery}"`);
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
                slackUtils_1.SlackLogger.info(`Search returned ${tasks.length} tasks for query: "${query}"`);
                return tasks;
            }
            catch (error) {
                slackUtils_1.SlackLogger.error(`Search failed for query "${query}":`, error);
                throw new Error(slack_1.SLACK_ERROR_MESSAGES.NETWORK_ERROR);
            }
        });
    }
    /**
     * Retrieves high priority tasks from all accessible channels
     * @param limit - Maximum number of tasks to retrieve (default: 20)
     * @returns Promise resolving to array of high priority tasks
     */
    async getHighPriorityTasks(limit = 20) {
        slackUtils_1.SlackLogger.debug(`Fetching ${limit} high priority tasks`);
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
                slackUtils_1.SlackLogger.info(`Retrieved ${highPriorityTasks.length} high priority tasks`);
                return highPriorityTasks;
            }
            catch (error) {
                slackUtils_1.SlackLogger.error('Failed to fetch high priority tasks:', error);
                throw new Error(slack_1.SLACK_ERROR_MESSAGES.NETWORK_ERROR);
            }
        });
    }
    /**
     * Retrieves list of task-related channel IDs
     * @returns Promise resolving to array of channel IDs
     */
    async getTaskChannels() {
        const cacheKey = 'task-channels';
        return this.getCachedData(cacheKey, async () => {
            try {
                slackUtils_1.SlackLogger.debug('Fetching task-related channels');
                const result = await this.client.conversations.list({
                    types: 'public_channel,private_channel',
                    limit: 200
                });
                if (!result.ok || !result.channels) {
                    throw new Error(result.error || 'Failed to fetch channels');
                }
                const taskChannels = slackUtils_1.SlackChannelFilter.filterTaskChannels(result.channels);
                const sortedChannels = slackUtils_1.SlackChannelFilter.sortChannelsByRelevance(taskChannels);
                const channelIds = sortedChannels.map(channel => channel.id);
                slackUtils_1.SlackLogger.info(`Found ${channelIds.length} task-related channels`);
                return channelIds;
            }
            catch (error) {
                slackUtils_1.SlackLogger.error('Failed to fetch task channels:', error);
                return [];
            }
        });
    }
    // =================== PRIVATE HELPER METHODS ===================
    /**
     * Retrieves tasks from a specific channel with intelligent filtering
     * @private
     */
    async getTasksFromChannel(channelId, limit) {
        try {
            slackUtils_1.SlackLogger.debug(`Fetching messages from channel ${channelId}`);
            const result = await this.client.conversations.history({
                channel: channelId,
                limit: slack_1.SLACK_BATCH_SIZE
            });
            if (!result.ok || !result.messages) {
                slackUtils_1.SlackLogger.warn(`Failed to fetch messages from channel ${channelId}: ${result.error}`);
                return [];
            }
            const channelInfo = await this.getChannelInfo(channelId);
            const tasks = [];
            for (const message of result.messages.slice(0, limit)) {
                const analysis = slackUtils_1.SlackTaskAnalyzer.analyzeMessage(message);
                if (analysis.isTask) {
                    // Enhance message with thread replies if available
                    const enhancedMessage = await this.enhanceMessageWithThread(message, channelId);
                    const ticket = this.convertSlackMessageToTicket(enhancedMessage, channelInfo);
                    tasks.push(ticket);
                    slackUtils_1.SlackLogger.debug(`Identified task: ${ticket.key} (confidence: ${analysis.confidence})`);
                }
            }
            return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        catch (error) {
            slackUtils_1.SlackLogger.error(`Error fetching tasks from channel ${channelId}:`, error);
            return [];
        }
    }
    /**
     * Processes search results and converts valid tasks to tickets
     * @private
     */
    async processSearchResults(matches) {
        const tasks = [];
        for (const match of matches) {
            try {
                const analysis = slackUtils_1.SlackTaskAnalyzer.analyzeMessage(match);
                if (analysis.isTask) {
                    const channelId = match.channel?.id || '';
                    const channelInfo = await this.getChannelInfo(channelId);
                    const ticket = this.convertSlackMessageToTicket(match, channelInfo);
                    tasks.push(ticket);
                }
            }
            catch (error) {
                slackUtils_1.SlackLogger.warn('Error processing search result:', error);
            }
        }
        return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    /**
     * Enhances a message with thread replies for better context
     * @private
     */
    async enhanceMessageWithThread(message, channelId) {
        if (!message.thread_ts || message.thread_ts === message.ts) {
            return message;
        }
        try {
            const replies = await this.client.conversations.replies({
                channel: channelId,
                ts: message.thread_ts,
                limit: slack_1.DEFAULT_THREAD_REPLIES_LIMIT
            });
            if (replies.ok && replies.messages) {
                return {
                    ...message,
                    thread_replies: replies.messages.slice(1) // Exclude parent message
                };
            }
        }
        catch (error) {
            slackUtils_1.SlackLogger.warn('Error fetching thread replies:', error);
        }
        return message;
    }
    /**
     * Retrieves channel information with caching
     * @private
     */
    async getChannelInfo(channelId) {
        if (!channelId) {
            return { id: 'unknown', name: 'unknown', is_private: false, is_archived: false };
        }
        const cacheKey = `channel-${channelId}`;
        return this.getCachedData(cacheKey, async () => {
            try {
                const result = await this.client.conversations.info({ channel: channelId });
                if (result.ok && result.channel) {
                    return result.channel;
                }
            }
            catch (error) {
                slackUtils_1.SlackLogger.warn(`Error fetching channel info for ${channelId}:`, error);
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
    convertSlackMessageToTicket(message, channel) {
        const analysis = slackUtils_1.SlackTaskAnalyzer.analyzeMessage(message);
        const messageId = message.ts.replace('.', '');
        return {
            id: message.ts,
            key: `SLACK-${channel.name || 'DM'}-${messageId}`,
            summary: slackUtils_1.SlackTextProcessor.extractSummary(message.text),
            description: slackUtils_1.SlackTextProcessor.cleanMessageText(message.text),
            provider: 'slack',
            priority: analysis.metadata.priority || 'medium',
            assignee: analysis.metadata.assignee,
            labels: analysis.metadata.labels || [],
            createdAt: slackUtils_1.SlackTimeUtils.timestampToDate(message.ts),
            updatedAt: slackUtils_1.SlackTimeUtils.getLastActivityDate(message),
            url: slackUtils_1.SlackUrlGenerator.generateMessageUrl(channel.id, message.ts),
            status: analysis.metadata.status || 'open'
        };
    }
    // =================== BASE CLASS IMPLEMENTATION ===================
    /**
     * Maps raw ticket data to RecentTicket format (required by base class)
     * @protected
     */
    mapToRecentTicket(rawTicket) {
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
    async makeRequest(_url, _options = {}) {
        throw new Error('Use Slack WebClient directly instead of makeRequest');
    }
    /**
     * Returns authentication headers (not used with WebClient)
     * @protected
     */
    getAuthHeaders() {
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
    async getCachedData(key, fetcher) {
        const cached = this.messageCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < slack_1.SLACK_CACHE_DURATION) {
            slackUtils_1.SlackLogger.debug(`Cache hit for key: ${key}`);
            return cached.data;
        }
        slackUtils_1.SlackLogger.debug(`Cache miss for key: ${key}, fetching fresh data`);
        try {
            const data = await fetcher();
            this.messageCache.set(key, {
                data,
                timestamp: Date.now()
            });
            return data;
        }
        catch (error) {
            slackUtils_1.SlackLogger.error(`Error fetching data for cache key ${key}:`, error);
            throw error;
        }
    }
    /**
     * Clears all cached data
     */
    clearCache() {
        const size = this.messageCache.size;
        this.messageCache.clear();
        slackUtils_1.SlackLogger.info(`Cleared cache (${size} entries)`);
    }
    /**
     * Returns cache statistics for debugging
     */
    getCacheStats() {
        return {
            size: this.messageCache.size,
            keys: Array.from(this.messageCache.keys())
        };
    }
}
exports.SlackProvider = SlackProvider;
//# sourceMappingURL=slack.js.map