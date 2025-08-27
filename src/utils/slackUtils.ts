/**
 * Utility functions for Slack message processing and task identification
 */

import { 
  TASK_KEYWORDS, 
  TASK_CHANNEL_PATTERNS, 
  TASK_REACTION_EMOJIS,
  PRIORITY_KEYWORDS,
  STATUS_KEYWORDS,
  ASSIGNEE_PATTERNS,
  MENTION_PATTERN,
  HASHTAG_PATTERN,
  LABEL_REACTIONS,
  TASK_FORMAT_PATTERNS,
  REACTION_STATUS_MAP,
  PRIORITY_REACTION_EMOJIS
} from '../constants/slack';
import { 
  SlackTask, 
  SlackChannel, 
  SlackReaction, 
  TaskIdentificationResult 
} from '../types';

/**
 * Logger utility for Slack operations
 */
export class SlackLogger {
  private static readonly PREFIX = '[SlackProvider]';

  /**
   * Log information message
   */
  static info(message: string, ...args: any[]): void {
    console.log(`${this.PREFIX} ${message}`, ...args);
  }

  /**
   * Log error message
   */
  static error(message: string, error?: any, ...args: any[]): void {
    console.error(`${this.PREFIX} ERROR: ${message}`, error, ...args);
  }

  /**
   * Log warning message
   */
  static warn(message: string, ...args: any[]): void {
    console.warn(`${this.PREFIX} WARNING: ${message}`, ...args);
  }

  /**
   * Log debug message (only in development)
   */
  static debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${this.PREFIX} DEBUG: ${message}`, ...args);
    }
  }
}

/**
 * Text processing utilities for Slack messages
 */
export class SlackTextProcessor {
  /**
   * Clean Slack message text by removing formatting and mentions
   */
  static cleanMessageText(text: string): string {
    if (!text) {return '';}
    
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '@user') // Replace user mentions
      .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1') // Replace channel mentions
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2') // Replace links with labels
      .replace(/<([^>]+)>/g, '$1') // Replace remaining formatting
      .replace(/\n\s*\n/g, '\n\n') // Clean up extra newlines
      .trim();
  }

  /**
   * Extract summary from message text (first sentence or line)
   */
  static extractSummary(text: string, maxLength = 100): string {
    if (!text) {return 'No summary available';}
    
    const cleaned = this.cleanMessageText(text);
    const firstLine = cleaned.split('\n')[0];
    const firstSentence = cleaned.split('.')[0];
    
    const summary = firstLine.length <= firstSentence.length ? firstLine : firstSentence;
    
    if (summary.length > maxLength) {
      return `${summary.substring(0, maxLength - 3)  }...`;
    }
    
    return summary || 'No summary available';
  }

  /**
   * Extract hashtags from message text
   */
  static extractHashtags(text: string): string[] {
    if (!text) {return [];}
    
    const matches = [...text.matchAll(HASHTAG_PATTERN)];
    return matches.map(match => match[1]);
  }

  /**
   * Extract user mentions from message text
   */
  static extractMentions(text: string): string[] {
    if (!text) {return [];}
    
    const matches = [...text.matchAll(MENTION_PATTERN)];
    return matches.map(match => match[1]);
  }

  /**
   * Check if text contains any of the specified patterns
   */
  static containsPatterns(text: string, patterns: readonly string[]): boolean {
    if (!text) {return false;}
    
    const lowerText = text.toLowerCase();
    return patterns.some(pattern => lowerText.includes(pattern));
  }

  /**
   * Check if text matches task format patterns
   */
  static hasTaskFormat(text: string): boolean {
    if (!text) {return false;}
    
    return TASK_FORMAT_PATTERNS.some(pattern => pattern.test(text));
  }
}

/**
 * Task identification and analysis utilities
 */
export class SlackTaskAnalyzer {
  /**
   * Analyze a Slack message to determine if it's a task
   */
  static analyzeMessage(message: SlackTask): TaskIdentificationResult {
    const reasons: string[] = [];
    let confidence = 0;

    // Check for task keywords
    if (SlackTextProcessor.containsPatterns(message.text, TASK_KEYWORDS)) {
      reasons.push('Contains task keywords');
      confidence += 0.4;
    }

    // Check for task reactions
    if (this.hasTaskReactions(message.reactions)) {
      reasons.push('Has task-related reactions');
      confidence += 0.3;
    }

    // Check for task format
    if (SlackTextProcessor.hasTaskFormat(message.text)) {
      reasons.push('Follows task format patterns');
      confidence += 0.3;
    }

    // Check for assignee mentions
    const mentions = SlackTextProcessor.extractMentions(message.text);
    if (mentions.length > 0) {
      reasons.push('Contains user mentions (potential assignees)');
      confidence += 0.2;
    }

    // Reduce confidence for bot messages (unless they contain task keywords)
    if (message.user && message.user.startsWith('B') && 
        !SlackTextProcessor.containsPatterns(message.text, TASK_KEYWORDS)) {
      confidence *= 0.5;
      reasons.push('Bot message (reduced confidence)');
    }

    const isTask = confidence >= 0.4;
    
    return {
      isTask,
      confidence: Math.min(confidence, 1),
      reasons,
      metadata: {
        priority: this.extractPriority(message),
        status: this.extractStatus(message),
        assignee: this.extractAssignee(message),
        labels: this.extractLabels(message)
      }
    };
  }

  /**
   * Extract priority from message content and reactions
   */
  static extractPriority(message: SlackTask): 'low' | 'medium' | 'high' | 'urgent' {
    const text = message.text?.toLowerCase() || '';
    
    // Check text for priority keywords
    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (SlackTextProcessor.containsPatterns(text, keywords)) {
        return priority as 'low' | 'medium' | 'high' | 'urgent';
      }
    }
    
    // Check reactions for priority indicators
    if (message.reactions) {
      for (const reaction of message.reactions) {
        if (PRIORITY_REACTION_EMOJIS.urgent.includes(reaction.name)) {
          return 'urgent';
        }
        if (PRIORITY_REACTION_EMOJIS.high.includes(reaction.name)) {
          return 'high';
        }
      }
    }
    
    return 'medium';
  }

  /**
   * Extract status from reactions and text content
   */
  static extractStatus(message: SlackTask): string {
    // Check reactions first (more reliable)
    if (message.reactions) {
      for (const reaction of message.reactions) {
        const status = REACTION_STATUS_MAP[reaction.name as keyof typeof REACTION_STATUS_MAP];
        if (status) {
          return status;
        }
      }
    }

    // Check text content for status keywords
    const text = message.text?.toLowerCase() || '';
    for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
      if (SlackTextProcessor.containsPatterns(text, keywords)) {
        return status;
      }
    }
    
    return 'open';
  }

  /**
   * Extract assignee from mentions and text patterns
   */
  static extractAssignee(message: SlackTask): string | undefined {
    const text = message.text || '';
    
    // Look for direct mentions first
    const mentions = SlackTextProcessor.extractMentions(text);
    if (mentions.length > 0) {
      return mentions[0]; // Return first mention
    }

    // Look for assignee patterns in text
    for (const pattern of ASSIGNEE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return match[1].replace('@', '');
      }
    }

    return undefined;
  }

  /**
   * Extract labels from hashtags, channel name, and reactions
   */
  static extractLabels(message: SlackTask, channel?: SlackChannel): string[] {
    const labels: string[] = [];

    // Add channel name as label
    if (channel?.name) {
      labels.push(`#${channel.name}`);
    }

    // Extract hashtags from message text
    const hashtags = SlackTextProcessor.extractHashtags(message.text);
    labels.push(...hashtags);

    // Extract labels from reactions
    if (message.reactions) {
      const labelReactions = message.reactions
        .filter(reaction => LABEL_REACTIONS.includes(reaction.name as any))
        .map(reaction => reaction.name);
      labels.push(...labelReactions);
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  /**
   * Check if message has task-related reactions
   */
  private static hasTaskReactions(reactions?: SlackReaction[]): boolean {
    if (!reactions) {return false;}
    
    return reactions.some(reaction => 
      TASK_REACTION_EMOJIS.includes(reaction.name as any)
    );
  }
}

/**
 * Channel filtering and identification utilities
 */
export class SlackChannelFilter {
  /**
   * Check if a channel name indicates it's task-related
   */
  static isTaskChannel(channelName: string): boolean {
    if (!channelName) {return false;}
    
    const lowerName = channelName.toLowerCase();
    return TASK_CHANNEL_PATTERNS.some(pattern => 
      lowerName.includes(pattern)
    );
  }

  /**
   * Filter channels to only include task-related ones
   */
  static filterTaskChannels(channels: SlackChannel[]): SlackChannel[] {
    return channels.filter(channel => 
      !channel.is_archived && 
      this.isTaskChannel(channel.name)
    );
  }

  /**
   * Sort channels by relevance for task tracking
   */
  static sortChannelsByRelevance(channels: SlackChannel[]): SlackChannel[] {
    return channels.sort((a, b) => {
      // Prioritize non-archived channels
      if (a.is_archived !== b.is_archived) {
        return a.is_archived ? 1 : -1;
      }

      // Prioritize channels with more members
      const aMemberCount = a.num_members || 0;
      const bMemberCount = b.num_members || 0;
      if (aMemberCount !== bMemberCount) {
        return bMemberCount - aMemberCount;
      }

      // Alphabetical order as fallback
      return a.name.localeCompare(b.name);
    });
  }
}

/**
 * Date and time utilities for Slack timestamps
 */
export class SlackTimeUtils {
  /**
   * Convert Slack timestamp to Date object
   */
  static timestampToDate(timestamp: string): Date {
    return new Date(parseFloat(timestamp) * 1000);
  }

  /**
   * Get the most recent activity date from message and thread replies
   */
  static getLastActivityDate(message: SlackTask): Date {
    // Check thread replies for latest activity
    if (message.thread_replies && message.thread_replies.length > 0) {
      const lastReply = message.thread_replies[message.thread_replies.length - 1];
      return this.timestampToDate(lastReply.ts);
    }
    
    // Use message timestamp as fallback
    return this.timestampToDate(message.ts);
  }

  /**
   * Format timestamp for display (relative time)
   */
  static formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${diffInDays}d ago`;
    }
  }
}

/**
 * URL generation utilities for Slack
 */
export class SlackUrlGenerator {
  /**
   * Generate Slack URL for a message
   */
  static generateMessageUrl(channelId: string, timestamp: string): string {
    const messageId = timestamp.replace('.', '');
    return `slack://channel/${channelId}/p${messageId}`;
  }

  /**
   * Generate web URL for a message (requires workspace domain)
   */
  static generateWebUrl(workspaceDomain: string, channelId: string, timestamp: string): string {
    const messageId = timestamp.replace('.', '');
    return `https://${workspaceDomain}.slack.com/archives/${channelId}/p${messageId}`;
  }
}

/**
 * Input validation utilities
 */
export class SlackValidator {
  /**
   * Validate Slack bot token format
   */
  static isValidBotToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Bot tokens should start with 'xoxb-' and be at least 50 characters
    return token.startsWith('xoxb-') && token.length >= 50;
  }

  /**
   * Validate channel ID format
   */
  static isValidChannelId(channelId: string): boolean {
    if (!channelId || typeof channelId !== 'string') {
      return false;
    }

    // Channel IDs typically start with 'C' and are alphanumeric
    return /^C[A-Z0-9]+$/.test(channelId);
  }

  /**
   * Validate user ID format
   */
  static isValidUserId(userId: string): boolean {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    // User IDs typically start with 'U' or 'W' and are alphanumeric
    return /^[UW][A-Z0-9]+$/.test(userId);
  }

  /**
   * Sanitize search query for Slack API
   */
  static sanitizeSearchQuery(query: string): string {
    if (!query) {return '';}
    
    // Remove potentially harmful characters and escape quotes
    return query
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/"/g, '\\"') // Escape quotes
      .trim();
  }
}