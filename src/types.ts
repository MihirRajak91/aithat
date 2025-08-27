export interface RecentTicket {
  id: string;
  key: string;
  summary: string;
  description: string;
  provider: 'jira' | 'linear' | 'github' | 'slack';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  url: string;
  status: string;
}

export interface LLMResponse {
  content: string;
  isStreaming: boolean;
}

export interface ProviderConfig {
  type: 'jira' | 'linear' | 'github' | 'slack';
  baseUrl?: string;
  token?: string;
}

export interface PlanGenerationOptions {
  includeCodeExamples: boolean;
  includeFileStructure: boolean;
  includeTestingStrategy: boolean;
  includeDeploymentSteps: boolean;
}

export interface WorkspaceContext {
  files: string[];
  structure: string;
  totalSize: number;
  ignoredFiles: string[];
}

export interface TaskGroup {
  title: string;
  icon: string;
  count: number;
  tasks: RecentTicket[];
  priority?: 'urgent' | 'high' | 'medium' | 'low';
}

export interface ProjectGroup {
  id: string;
  name: string;
  key: string;
  taskCount: number;
  icon?: string;
  description?: string;
  tasks: RecentTicket[];
}

export interface TaskFilter {
  status?: string[];
  priority?: string[];
  assignee?: string;
  project?: string;
  labels?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface JiraBoard {
  id: number;
  name: string;
  type?: string;
  taskCount: number;
  projectKey?: string;
  location?: {
    projectId: string;
    projectName: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: Date;
  endDate?: Date;
  taskCount?: number;
}

/**
 * Slack channel information with enhanced type safety
 */
export interface SlackChannel {
  /** Unique channel identifier */
  id: string;
  /** Human-readable channel name */
  name: string;
  /** Whether the channel is private */
  is_private: boolean;
  /** Whether the channel is archived */
  is_archived: boolean;
  /** Channel topic information */
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  /** Channel purpose information */
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  /** Number of members in the channel */
  num_members?: number;
}

/**
 * Slack message reaction information
 */
export interface SlackReaction {
  /** Emoji name (without colons) */
  name: string;
  /** Number of users who reacted */
  count: number;
  /** Array of user IDs who reacted */
  users: string[];
}

/**
 * Slack message thread reply
 */
export interface SlackThreadReply {
  /** Message timestamp */
  ts: string;
  /** User who sent the reply */
  user: string;
  /** Reply text content */
  text: string;
}

/**
 * Enhanced Slack task/message representation
 */
export interface SlackTask {
  /** Message timestamp (unique identifier) */
  ts: string;
  /** Channel ID where message was posted */
  channel: string;
  /** Message text content */
  text: string;
  /** User ID who posted the message */
  user: string;
  /** Thread timestamp if message is part of a thread */
  thread_ts?: string;
  /** Array of emoji reactions */
  reactions?: SlackReaction[];
  /** Message attachments */
  attachments?: any[];
  /** File attachments */
  files?: any[];
  /** Thread replies (populated when needed) */
  thread_replies?: SlackThreadReply[];
  /** Associated channel information */
  channel_info?: SlackChannel;
}

/**
 * Slack search API response structure
 */
export interface SlackSearchResult {
  /** Search results for messages */
  messages?: {
    /** Array of matching messages */
    matches: any[];
    /** Pagination information */
    paging: {
      count: number;
      total: number;
      page: number;
      pages: number;
    };
  };
  /** Whether the search was successful */
  ok?: boolean;
  /** Error message if search failed */
  error?: string;
}

/**
 * Slack provider configuration
 */
export interface SlackConfig {
  /** Bot token for Slack API authentication */
  token: string;
  /** Optional workspace ID for multi-workspace scenarios */
  workspaceId?: string;
  /** Custom API endpoint (for enterprise) */
  apiEndpoint?: string;
}

/**
 * Slack user information
 */
export interface SlackUser {
  /** User ID */
  id: string;
  /** Display name */
  name: string;
  /** Real name */
  real_name?: string;
  /** Profile information */
  profile?: {
    display_name?: string;
    real_name?: string;
    email?: string;
  };
}

/**
 * Cache entry structure for Slack data
 */
export interface SlackCacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Timestamp when data was cached */
  timestamp: number;
}

/**
 * Task identification result
 */
export interface TaskIdentificationResult {
  /** Whether the message qualifies as a task */
  isTask: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasons why it was identified as a task */
  reasons: string[];
  /** Extracted metadata */
  metadata: {
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: string;
    assignee?: string;
    labels?: string[];
  };
}
