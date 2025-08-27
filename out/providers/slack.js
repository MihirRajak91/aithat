"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackProvider = void 0;
const base_1 = require("./base");
const web_api_1 = require("@slack/web-api");
class SlackProvider extends base_1.BaseProvider {
    getProviderName() {
        return 'slack';
    }
    constructor(config) {
        super(config);
        this.messageCache = new Map();
        this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (longer due to rate limits)
        this.BATCH_SIZE = 15; // Align with Slack's new rate limits
        this.currentUser = null;
        this.client = new web_api_1.WebClient(config.token);
    }
    async validateConfig() {
        if (!this.config.token) {
            return false;
        }
        try {
            const auth = await this.client.auth.test();
            this.currentUser = auth.user; // Cache user info
            return auth.ok === true;
        }
        catch (error) {
            console.error('Slack validation failed:', error);
            return false;
        }
    }
    // =================== CORE OPTIMIZED METHODS ===================
    async getTicket(id) {
        // For Slack, the ID format is timestamp (ts)
        // We'll need to search for the message by its timestamp
        throw new Error('getTicket not implemented for Slack - use search instead');
    }
    async getRecentTickets(limit = 10) {
        const cacheKey = `recent-tasks-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const taskChannels = await this.getTaskChannels();
            const allTasks = [];
            // Process channels in batches to respect rate limits
            for (const channelId of taskChannels.slice(0, 10)) {
                try {
                    const channelTasks = await this.getTasksFromChannel(channelId, Math.ceil(limit / 2));
                    allTasks.push(...channelTasks);
                }
                catch (error) {
                    console.error(`Error fetching tasks from channel ${channelId}:`, error);
                }
            }
            // Sort by updated time and limit results
            return allTasks
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .slice(0, limit);
        });
    }
    async getMyTaskMentions(days = 7, limit = 20) {
        const cacheKey = `my-mentions-${days}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            if (!this.currentUser) {
                await this.validateConfig(); // Ensure we have user info
            }
            const query = `from:@${this.currentUser} OR mentions:@${this.currentUser}`;
            const result = await this.client.search.messages({
                query,
                count: limit,
                sort: 'timestamp',
                sort_dir: 'desc'
            });
            if (!result.messages?.matches) {
                return [];
            }
            const tasks = [];
            for (const match of result.messages.matches.slice(0, limit)) {
                if (this.isTaskMessage(match)) {
                    const channel = await this.getChannelInfo(match.channel?.id || '');
                    const ticketData = { ...match, channel };
                    tasks.push(this.mapToRecentTicket(ticketData));
                }
            }
            return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        });
    }
    async getTasksByChannel(channelId, limit = 20) {
        const cacheKey = `channel-tasks-${channelId}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            return await this.getTasksFromChannel(channelId, limit);
        });
    }
    async searchTasks(query, limit = 20) {
        const cacheKey = `search-${query}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            // Enhance search query with task-related keywords
            const enhancedQuery = `${query} (TODO OR task OR bug OR feature OR urgent OR priority)`;
            const result = await this.client.search.messages({
                query: enhancedQuery,
                count: limit,
                sort: 'timestamp',
                sort_dir: 'desc'
            });
            if (!result.messages?.matches) {
                return [];
            }
            const tasks = [];
            for (const match of result.messages.matches) {
                if (this.isTaskMessage(match)) {
                    const channel = await this.getChannelInfo(match.channel?.id || '');
                    const ticketData = { ...match, channel };
                    tasks.push(this.mapToRecentTicket(ticketData));
                }
            }
            return tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        });
    }
    async getTaskChannels() {
        const cacheKey = 'task-channels';
        return this.getCachedData(cacheKey, async () => {
            const result = await this.client.conversations.list({
                types: 'public_channel,private_channel',
                limit: 200
            });
            if (!result.channels) {
                return [];
            }
            // Filter for task-related channels
            return result.channels
                .filter(channel => {
                const name = channel.name?.toLowerCase() || '';
                return name.includes('task') ||
                    name.includes('todo') ||
                    name.includes('project') ||
                    name.includes('sprint') ||
                    name.includes('bug') ||
                    name.includes('feature') ||
                    name.includes('dev') ||
                    name.includes('engineering');
            })
                .map(channel => channel.id)
                .filter(Boolean);
        });
    }
    async getHighPriorityTasks(limit = 20) {
        const cacheKey = `high-priority-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const query = '🔥 OR urgent OR critical OR "high priority" OR emergency';
            const result = await this.client.search.messages({
                query,
                count: limit * 2, // Get more to filter
                sort: 'timestamp',
                sort_dir: 'desc'
            });
            if (!result.messages?.matches) {
                return [];
            }
            const tasks = [];
            for (const match of result.messages.matches) {
                if (this.isTaskMessage(match) && (this.extractPriority(match) === 'urgent' || this.extractPriority(match) === 'high')) {
                    const channel = await this.getChannelInfo(match.channel?.id || '');
                    const ticketData = { ...match, channel };
                    tasks.push(this.mapToRecentTicket(ticketData));
                }
            }
            return tasks
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .slice(0, limit);
        });
    }
    // =================== HELPER METHODS ===================
    async getTasksFromChannel(channelId, limit) {
        try {
            const result = await this.client.conversations.history({
                channel: channelId,
                limit: this.BATCH_SIZE
            });
            if (!result.messages) {
                return [];
            }
            const tasks = [];
            const channel = await this.getChannelInfo(channelId);
            for (const message of result.messages.slice(0, limit)) {
                if (this.isTaskMessage(message)) {
                    // Get thread replies for additional context
                    if (message.thread_ts && message.thread_ts !== message.ts) {
                        try {
                            const replies = await this.client.conversations.replies({
                                channel: channelId,
                                ts: message.thread_ts,
                                limit: 5
                            });
                            message.thread_replies = replies.messages?.slice(1) || []; // Exclude parent message
                        }
                        catch (error) {
                            console.error('Error fetching thread replies:', error);
                        }
                    }
                    const ticketData = { ...message, channel };
                    tasks.push(this.mapToRecentTicket(ticketData));
                }
            }
            return tasks;
        }
        catch (error) {
            console.error(`Error fetching tasks from channel ${channelId}:`, error);
            return [];
        }
    }
    async getChannelInfo(channelId) {
        const cacheKey = `channel-${channelId}`;
        return this.getCachedData(cacheKey, async () => {
            try {
                const result = await this.client.conversations.info({
                    channel: channelId
                });
                return result.channel || { id: channelId, name: 'unknown' };
            }
            catch (error) {
                return { id: channelId, name: 'unknown' };
            }
        });
    }
    isTaskMessage(message) {
        if (!message.text)
            return false;
        const text = message.text.toLowerCase();
        // Skip bot messages unless they contain task keywords
        if (message.bot_id && !this.containsTaskKeywords(text)) {
            return false;
        }
        // Must contain task-related keywords or indicators
        return this.containsTaskKeywords(text) ||
            this.hasTaskReactions(message) ||
            this.hasTaskFormat(text);
    }
    containsTaskKeywords(text) {
        const taskKeywords = [
            'todo', 'task', 'bug', 'feature', 'issue', 'fix', 'implement',
            'urgent', 'priority', 'deadline', 'assigned', 'complete', 'done',
            'need to', 'should', 'must', 'requirement', 'story', 'epic'
        ];
        return taskKeywords.some(keyword => text.includes(keyword));
    }
    hasTaskReactions(message) {
        if (!message.reactions)
            return false;
        const taskReactions = [
            'white_check_mark', 'heavy_check_mark', 'x', 'hourglass_flowing_sand',
            'red_circle', 'yellow_circle', 'green_circle', 'eyes', 'raising_hand'
        ];
        return message.reactions.some((reaction) => taskReactions.includes(reaction.name));
    }
    hasTaskFormat(text) {
        // Check for common task formats
        return /^[-*+]\s/.test(text) || // Bullet points
            /^\d+\.\s/.test(text) || // Numbered lists
            /\[[\sx]\]/i.test(text) || // Checkboxes
            /^(TODO|FIXME|NOTE|HACK):/.test(text.toUpperCase()); // Code comments
    }
    extractPriority(message) {
        const text = message.text?.toLowerCase() || '';
        // Check emojis and keywords for priority
        if (text.includes('🔥') || text.includes('urgent') || text.includes('critical') || text.includes('emergency')) {
            return 'urgent';
        }
        if (text.includes('⚡') || text.includes('high priority') || text.includes('important') || text.includes('asap')) {
            return 'high';
        }
        if (text.includes('low priority') || text.includes('nice to have') || text.includes('when time permits')) {
            return 'low';
        }
        // Check reactions for priority indicators
        if (message.reactions) {
            for (const reaction of message.reactions) {
                if (['fire', 'rotating_light', 'warning'].includes(reaction.name)) {
                    return 'urgent';
                }
                if (['zap', 'exclamation'].includes(reaction.name)) {
                    return 'high';
                }
            }
        }
        return 'medium';
    }
    extractStatus(message) {
        const reactions = message.reactions || [];
        // Status mapping from reactions
        const statusMap = {
            'white_check_mark': 'completed',
            'heavy_check_mark': 'completed',
            'x': 'cancelled',
            'hourglass_flowing_sand': 'in_progress',
            'red_circle': 'blocked',
            'yellow_circle': 'waiting',
            'green_circle': 'ready',
            'eyes': 'in_review',
            'raising_hand': 'assigned'
        };
        for (const reaction of reactions) {
            if (statusMap[reaction.name]) {
                return statusMap[reaction.name];
            }
        }
        // Check text for status keywords
        const text = message.text?.toLowerCase() || '';
        if (text.includes('completed') || text.includes('done') || text.includes('finished')) {
            return 'completed';
        }
        if (text.includes('in progress') || text.includes('working on') || text.includes('started')) {
            return 'in_progress';
        }
        if (text.includes('blocked') || text.includes('stuck') || text.includes('waiting for')) {
            return 'blocked';
        }
        return 'open';
    }
    extractAssignee(message) {
        const text = message.text || '';
        // Look for @mentions (assignee patterns)
        const mentionPattern = /<@([UW][A-Z0-9]+)>/g;
        const mentions = [...text.matchAll(mentionPattern)];
        if (mentions.length > 0) {
            // Return the first mention (could be enhanced to get display name)
            return mentions[0][1];
        }
        // Look for assignee patterns in text
        const assigneePatterns = [
            /assigned to (@?\w+)/i,
            /assignee:?\s*(@?\w+)/i,
            /@(\w+)\s+(please|can you|could you)/i
        ];
        for (const pattern of assigneePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].replace('@', '');
            }
        }
        return undefined;
    }
    extractLabels(message, channel) {
        const labels = [];
        const text = message.text || '';
        // Add channel name as a label
        if (channel?.name) {
            labels.push(`#${channel.name}`);
        }
        // Extract hashtags
        const hashtagPattern = /#(\w+)/g;
        const hashtags = [...text.matchAll(hashtagPattern)];
        labels.push(...hashtags.map(match => match[1]));
        // Extract common labels from reactions
        if (message.reactions) {
            const labelReactions = ['bug', 'enhancement', 'question', 'documentation'];
            for (const reaction of message.reactions) {
                if (labelReactions.includes(reaction.name)) {
                    labels.push(reaction.name);
                }
            }
        }
        return [...new Set(labels)]; // Remove duplicates
    }
    extractSummary(text) {
        if (!text)
            return 'No summary available';
        // Remove Slack formatting
        let cleaned = text
            .replace(/<@[UW][A-Z0-9]+>/g, '@user') // Replace user mentions
            .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1') // Replace channel mentions
            .replace(/<[^>]+>/g, '') // Remove other formatting
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .trim();
        // Take first sentence or first line, whichever is shorter
        const firstLine = cleaned.split('\n')[0];
        const firstSentence = cleaned.split('.')[0];
        const summary = firstLine.length <= firstSentence.length ? firstLine : firstSentence;
        // Truncate if too long
        if (summary.length > 100) {
            return summary.substring(0, 97) + '...';
        }
        return summary || 'No summary available';
    }
    getLastActivity(message) {
        // Check thread replies for latest activity
        if (message.thread_replies && message.thread_replies.length > 0) {
            const lastReply = message.thread_replies[message.thread_replies.length - 1];
            return new Date(parseFloat(lastReply.ts) * 1000);
        }
        // Check reactions for latest activity
        if (message.reactions && message.reactions.length > 0) {
            // Use message timestamp as proxy (reactions don't have timestamps)
            return new Date(parseFloat(message.ts) * 1000);
        }
        return new Date(parseFloat(message.ts) * 1000);
    }
    mapToRecentTicket(rawTicket) {
        // For compatibility with base class, we need to handle both formats
        if (rawTicket.channel) {
            // This is already processed
            return this.mapSlackMessageToTicket(rawTicket, rawTicket.channel);
        }
        else {
            // Fallback for base class compatibility
            return this.mapSlackMessageToTicket(rawTicket, { id: 'unknown', name: 'unknown' });
        }
    }
    mapSlackMessageToTicket(message, channel) {
        const timestamp = parseFloat(message.ts);
        const messageId = message.ts.replace('.', '');
        return {
            id: message.ts,
            key: `SLACK-${channel.name || 'DM'}-${messageId}`,
            summary: this.extractSummary(message.text),
            description: this.cleanMessageText(message.text),
            provider: 'slack',
            priority: this.extractPriority(message),
            assignee: this.extractAssignee(message),
            labels: this.extractLabels(message, channel),
            createdAt: new Date(timestamp * 1000),
            updatedAt: this.getLastActivity(message),
            url: `slack://channel/${channel.id}/p${messageId}`,
            status: this.extractStatus(message)
        };
    }
    cleanMessageText(text) {
        if (!text)
            return '';
        return text
            .replace(/<@[UW][A-Z0-9]+>/g, '@user') // Replace user mentions
            .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1') // Replace channel mentions
            .replace(/<([^|>]+)\|([^>]+)>/g, '$2') // Replace links with labels
            .replace(/<([^>]+)>/g, '$1') // Replace remaining formatting
            .replace(/\n\s*\n/g, '\n\n') // Clean up extra newlines
            .trim();
    }
    // Caching system (same as JiraProvider)
    async getCachedData(key, fetcher) {
        const cached = this.messageCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            return cached.data;
        }
        const data = await fetcher();
        this.messageCache.set(key, { data, timestamp: Date.now() });
        return data;
    }
    // Clear cache (useful for refresh operations)
    clearCache() {
        this.messageCache.clear();
    }
    // Get cache stats (for debugging)
    getCacheStats() {
        return {
            size: this.messageCache.size,
            keys: Array.from(this.messageCache.keys())
        };
    }
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json; charset=utf-8'
        };
    }
    // Override makeRequest to use Slack Web API client instead of axios
    async makeRequest(url, options = {}) {
        // This method is not used in SlackProvider as we use the WebClient directly
        throw new Error('Use Slack WebClient directly instead of makeRequest');
    }
}
exports.SlackProvider = SlackProvider;
//# sourceMappingURL=slack.js.map